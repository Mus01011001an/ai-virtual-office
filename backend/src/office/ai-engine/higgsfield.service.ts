import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from 'src/database/database.service';
import { s3, getS3Bucket, getS3PermanentUrl } from 'src/common/infrastructure/s3';
import { OfficeEventsService } from '../realtime/office-events.service';
import { SystemSettingsService } from './system-settings.service';

/**
 * Higgsfield (https://docs.higgsfield.ai) — generasi gambar & video untuk AI marketing/sosmed.
 * Kredensial level platform (superadmin): SystemSetting "higgsfield" = { keyId, keySecret, imageModel?, videoModel?, imageToVideoModel? }
 * atau env HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET.
 * Alur API: POST /<model> → { request_id, status_url } → GET status sampai completed → images[].url / video.url.
 * URL hasil kedaluwarsa ±7 hari, jadi file disalin ke S3 dan dicatat sebagai Artifact.
 */
export const HIGGSFIELD_SETTING = 'higgsfield';
const BASE = 'https://api.higgsfield.ai';
export const HIGGSFIELD_DEFAULTS = {
  imageModel: 'higgsfield-ai/soul/standard',
  videoModel: 'kling-video/v3.0/pro/text-to-video',
  imageToVideoModel: 'wan/v2.6/image-to-video',
};
const TERMINAL = new Set(['completed', 'failed', 'nsfw', 'canceled']);

interface HfConfig { keyId: string; keySecret: string; imageModel: string; videoModel: string; imageToVideoModel: string }
interface HfStatus {
  status: string; request_id: string; status_url?: string; error?: string | null;
  images?: { url: string }[]; video?: { url: string } | null;
}
export interface HfContext { companyId: string; employeeId?: string; taskId?: string }

@Injectable()
export class HiggsfieldService {
  private readonly logger = new Logger(HiggsfieldService.name);

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly prisma: DatabaseService,
    @Optional() private readonly events?: OfficeEventsService,
  ) {}

  async config(): Promise<HfConfig | null> {
    const s = (await this.settings.getJson<Partial<HfConfig>>(HIGGSFIELD_SETTING)) ?? {};
    const keyId = s.keyId || process.env.HIGGSFIELD_API_KEY_ID || '';
    const keySecret = s.keySecret || process.env.HIGGSFIELD_API_KEY_SECRET || '';
    if (!keyId || !keySecret) return null;
    return {
      keyId, keySecret,
      imageModel: s.imageModel || HIGGSFIELD_DEFAULTS.imageModel,
      videoModel: s.videoModel || HIGGSFIELD_DEFAULTS.videoModel,
      imageToVideoModel: s.imageToVideoModel || HIGGSFIELD_DEFAULTS.imageToVideoModel,
    };
  }

  private async req<T>(cfg: HfConfig, url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url.startsWith('http') ? url : `${BASE}/${url.replace(/^\//, '')}`, {
      ...init,
      headers: { Authorization: `Key ${cfg.keyId}:${cfg.keySecret}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { detail: text.slice(0, 200) }; }
    if (!res.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail ?? body ?? '').slice(0, 200);
      throw new Error(`Higgsfield ${res.status}: ${detail}`);
    }
    return body as T;
  }

  /** Cek kredensial: GET daftar style SOUL (ringan, tidak memakai kredit). */
  async test(override?: { keyId: string; keySecret: string }) {
    const base = await this.config();
    const cfg = { ...HIGGSFIELD_DEFAULTS, ...(base ?? {}), ...(override ?? {}) } as HfConfig;
    if (!cfg.keyId || !cfg.keySecret) return { ok: false, message: 'Kredensial Higgsfield belum diisi' };
    const started = Date.now();
    try {
      const styles = await this.req<unknown[]>(cfg, 'v1/text2image/soul-styles', { method: 'GET' });
      return { ok: true, latencyMs: Date.now() - started, message: `Terhubung · ${Array.isArray(styles) ? styles.length : 0} style tersedia` };
    } catch (e: any) {
      return { ok: false, latencyMs: Date.now() - started, message: e.message };
    }
  }

  private async submit(cfg: HfConfig, model: string, body: Record<string, unknown>) {
    return this.req<HfStatus>(cfg, model, { method: 'POST', body: JSON.stringify(body) });
  }

  private async waitFor(cfg: HfConfig, handle: HfStatus, timeoutMs: number): Promise<HfStatus> {
    const url = handle.status_url || `${BASE}/requests/${handle.request_id}/status`;
    const until = Date.now() + timeoutMs;
    let delay = 2000;
    let last = handle;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, delay));
      last = await this.req<HfStatus>(cfg, url, { method: 'GET' });
      if (TERMINAL.has(last.status)) return last;
      delay = Math.min(delay * 1.4, 10_000);
    }
    return last;
  }

  /** Salin hasil ke S3 + Artifact supaya tidak hilang setelah URL Higgsfield kedaluwarsa. */
  private async persist(ctx: HfContext, sourceUrl: string, kind: 'image' | 'video', prompt: string) {
    let url = sourceUrl;
    let size = 0;
    const ext = kind === 'video' ? 'mp4' : (sourceUrl.split('?')[0].split('.').pop() || 'png').slice(0, 4);
    const mimeType = kind === 'video' ? 'video/mp4' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const name = `${kind}-${Date.now()}.${ext}`;
    try {
      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(120_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        size = buf.length;
        const key = `virtual-office/higgsfield/${ctx.companyId}/${name}`;
        await s3.send(new PutObjectCommand({ Bucket: getS3Bucket(), Key: key, Body: buf, ContentType: mimeType }));
        url = getS3PermanentUrl(key);
      }
    } catch (e: any) {
      this.logger.warn(`Gagal menyalin hasil Higgsfield ke S3, memakai URL asli: ${e.message}`);
    }
    const artifact = await this.prisma.artifact.create({
      data: {
        companyId: ctx.companyId, employeeId: ctx.employeeId ?? null, taskId: ctx.taskId ?? null,
        name, mimeType, size, s3Key: '', url, metadata: { source: 'higgsfield', prompt: prompt.slice(0, 500), originalUrl: sourceUrl },
      },
    });
    this.events?.emit(ctx.companyId, 'artifact.created', artifact);
    return artifact;
  }

  private async requireConfig() {
    const cfg = await this.config();
    if (!cfg) throw new BadRequestException('Higgsfield belum dihubungkan. Minta administrator mengisi kredensial di Admin → Integrasi.');
    return cfg;
  }

  /** Gambar: menunggu sampai selesai (maks ~2 menit). */
  async generateImage(ctx: HfContext, input: { prompt: string; aspect_ratio?: string; resolution?: string; image_reference_url?: string }) {
    const cfg = await this.requireConfig();
    const body: Record<string, unknown> = {
      prompt: input.prompt.slice(0, 2000),
      aspect_ratio: input.aspect_ratio || '1:1',
      resolution: input.resolution || '1080p',
    };
    if (input.image_reference_url) body.image_reference_url = input.image_reference_url;
    const handle = await this.submit(cfg, cfg.imageModel, body);
    const done = await this.waitFor(cfg, handle, 150_000);
    if (done.status !== 'completed') {
      if (TERMINAL.has(done.status)) throw new Error(`Generasi gambar ${done.status}${done.error ? `: ${done.error}` : ''}`);
      return { status: 'pending' as const, requestId: handle.request_id };
    }
    const urls = (done.images ?? []).map((i) => i.url).filter(Boolean);
    if (!urls.length) throw new Error('Higgsfield tidak mengembalikan gambar');
    const artifacts: Awaited<ReturnType<HiggsfieldService['persist']>>[] = [];
    for (const u of urls) artifacts.push(await this.persist(ctx, u, 'image', input.prompt));
    return { status: 'completed' as const, requestId: handle.request_id, artifacts };
  }

  /**
   * Video: proses bisa beberapa menit, jadi dikirim lalu dipantau di background.
   * onDone dipanggil saat artifact siap (runtime mencatat ke otak kantor & feed).
   */
  async generateVideo(
    ctx: HfContext,
    input: { prompt: string; image_url?: string; duration?: number; aspect_ratio?: string },
    onDone?: (r: { ok: boolean; url?: string; error?: string }) => void,
  ) {
    const cfg = await this.requireConfig();
    const fromImage = !!input.image_url;
    const model = fromImage ? cfg.imageToVideoModel : cfg.videoModel;
    const body: Record<string, unknown> = fromImage
      ? { prompt: input.prompt.slice(0, 2000), image_url: input.image_url, duration: [5, 10, 15].includes(Number(input.duration)) ? Number(input.duration) : 5 }
      : { prompt: input.prompt.slice(0, 2500), duration: Math.min(15, Math.max(3, Number(input.duration) || 5)), aspect_ratio: input.aspect_ratio || '9:16' };
    const handle = await this.submit(cfg, model, body);
    void (async () => {
      try {
        const done = await this.waitFor(cfg, handle, 15 * 60_000);
        if (done.status !== 'completed' || !done.video?.url) {
          onDone?.({ ok: false, error: done.error || `status ${done.status}` });
          return;
        }
        const art = await this.persist(ctx, done.video.url, 'video', input.prompt);
        onDone?.({ ok: true, url: art.url ?? undefined });
      } catch (e: any) {
        this.logger.warn(`Video Higgsfield ${handle.request_id} gagal: ${e.message}`);
        onDone?.({ ok: false, error: e.message });
      }
    })();
    return { status: 'queued' as const, requestId: handle.request_id, model };
  }
}
