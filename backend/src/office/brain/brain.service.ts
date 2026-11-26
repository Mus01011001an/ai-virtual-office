import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';

export const BRAIN_KINDS = ['brief', 'decision', 'note', 'result', 'handoff', 'asset'] as const;
export type BrainKind = (typeof BRAIN_KINDS)[number];

const MAX_CONTEXT_CHARS = 6000;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Otak Kantor — satu memori bersama per office.
 * Semua AI membaca konteks yang sama (brief, keputusan, hasil kerja rekan, roster tim) sebelum bekerja,
 * dan menulis hasil/keputusan kembali ke sini, sehingga konteks tidak hilang antar agen.
 */
@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);

  constructor(
    private readonly prisma: DatabaseService,
    @Optional() private readonly events?: OfficeEventsService,
  ) {}

  async record(input: {
    companyId: string; employeeId?: string | null; kind: BrainKind; title: string; content: string;
    tags?: string[]; pinned?: boolean; createdById?: string | null;
  }) {
    const row = await this.prisma.brainEntry.create({
      data: {
        companyId: input.companyId, employeeId: input.employeeId ?? null, kind: input.kind,
        title: clip(input.title.trim(), 160), content: clip(input.content.trim(), 12000),
        tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
        pinned: input.pinned ?? false, createdById: input.createdById ?? null,
      },
      include: { employee: { select: { name: true, role: true } } },
    });
    this.events?.emit(input.companyId, 'brain.entry', row);
    return row;
  }

  /** Catat tanpa menggagalkan alur utama (dipakai runtime setelah task selesai). */
  async recordSafe(input: Parameters<BrainService['record']>[0]) {
    try { return await this.record(input); } catch (e: any) { this.logger.warn(`Gagal menulis otak kantor: ${e.message}`); return null; }
  }

  async list(companyId: string, p: { q?: string; kind?: string; limit?: number; before?: string }) {
    const where: Prisma.BrainEntryWhereInput = { companyId };
    if (p.kind && (BRAIN_KINDS as readonly string[]).includes(p.kind)) where.kind = p.kind;
    if (p.q?.trim()) {
      const q = p.q.trim();
      where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }];
    }
    if (p.before) where.createdAt = { lt: new Date(p.before) };
    const rows = await this.prisma.brainEntry.findMany({
      where, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: Math.min(p.limit ?? 50, 100),
      include: { employee: { select: { name: true, role: true } } },
    });
    return { data: rows, meta: { total: rows.length } };
  }

  async setPinned(companyId: string, id: string, pinned: boolean) {
    const row = await this.prisma.brainEntry.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Catatan tidak ditemukan');
    const out = await this.prisma.brainEntry.update({ where: { id }, data: { pinned }, include: { employee: { select: { name: true, role: true } } } });
    this.events?.emit(companyId, 'brain.entry', out);
    return out;
  }

  async remove(companyId: string, id: string) {
    const row = await this.prisma.brainEntry.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Catatan tidak ditemukan');
    await this.prisma.brainEntry.delete({ where: { id } });
    this.events?.emit(companyId, 'brain.deleted', { id });
    return { success: true, data: { id } };
  }

  /** Pencarian untuk tool brain_recall. */
  async search(companyId: string, query: string, limit = 6) {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
    const rows = await this.prisma.brainEntry.findMany({
      where: {
        companyId,
        ...(words.length ? { OR: words.flatMap((w) => [{ title: { contains: w, mode: 'insensitive' as const } }, { content: { contains: w, mode: 'insensitive' as const } }]) } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: limit,
      include: { employee: { select: { name: true } } },
    });
    return rows;
  }

  /**
   * Konteks bersama yang disuntikkan ke system prompt SETIAP agen.
   * Isi: brief/keputusan yang di-pin, roster tim (siapa ahli apa), hasil kerja & serah-terima terbaru.
   */
  async buildContext(companyId: string, selfId?: string): Promise<string> {
    try {
      const [team, pinned, recent] = await Promise.all([
        this.prisma.employee.findMany({
          where: { companyId, deletedAt: null, isDemo: false },
          select: { id: true, name: true, role: true, skills: true, status: true, currentTask: true },
          orderBy: { deskIndex: 'asc' }, take: 30,
        }),
        this.prisma.brainEntry.findMany({ where: { companyId, pinned: true }, orderBy: { createdAt: 'desc' }, take: 8 }),
        this.prisma.brainEntry.findMany({
          where: { companyId, pinned: false }, orderBy: { createdAt: 'desc' }, take: 12,
          include: { employee: { select: { name: true } } },
        }),
      ]);

      const parts: string[] = ['## OTAK KANTOR (memori bersama seluruh tim — selalu konsisten dengan ini)'];
      if (team.length) {
        parts.push('### Tim', ...team.map((t) =>
          `- ${t.name}${t.id === selfId ? ' (kamu)' : ''} — ${t.role}${t.skills.length ? ` · ${t.skills.slice(0, 4).join(', ')}` : ''}${t.currentTask ? ` · sedang: ${clip(t.currentTask, 60)}` : ''}`));
      }
      if (pinned.length) {
        parts.push('### Brief & keputusan tetap', ...pinned.map((b) => `- [${b.kind}] ${b.title}: ${clip(b.content.replace(/\s+/g, ' '), 400)}`));
      }
      if (recent.length) {
        parts.push('### Aktivitas & hasil terbaru', ...recent.map((b) =>
          `- [${b.kind}] ${b.employee?.name ? `${b.employee.name}: ` : ''}${b.title} — ${clip(b.content.replace(/\s+/g, ' '), 220)}`));
      }
      parts.push(
        '### Cara kerja bersama',
        '- Pakai `brain_recall` untuk mencari detail di otak kantor sebelum mengulang pekerjaan.',
        '- Pakai `brain_note` untuk mencatat keputusan/fakta penting supaya rekan lain tahu.',
        '- Pakai `delegate_task` bila pekerjaan lebih cocok dikerjakan rekan (sebut nama/role-nya).',
      );
      return clip(parts.join('\n'), MAX_CONTEXT_CHARS);
    } catch (e: any) {
      this.logger.warn(`Gagal menyusun konteks otak kantor: ${e.message}`);
      return '';
    }
  }
}
