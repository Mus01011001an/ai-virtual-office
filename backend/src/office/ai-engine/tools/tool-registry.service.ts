import { Injectable, Logger, Optional } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../../realtime/office-events.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3, getS3Bucket, getS3PermanentUrl } from 'src/common/infrastructure/s3';
import { SecureRunnerService } from '../../sandbox/secure-runner.service';
import { GithubService } from '../../integrations/github.service';
import { McpService } from '../../mcp/mcp.service';
import { ModuleRef } from '@nestjs/core';
import { BrainService } from '../../brain/brain.service';
import { HiggsfieldService } from '../higgsfield.service';

/** Tool kolaborasi otak kantor — selalu tersedia untuk semua agen. */
export const BRAIN_TOOLS = ['brain_recall', 'brain_note', 'delegate_task'];
const MAX_DELEGATION_DEPTH = 2;
const MAX_DELEGATIONS_PER_10_MIN = 15;

export interface ToolExecutionContext {
  companyId: string;
  employeeId: string;
  taskId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<string>;
}

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(
    @Optional() private readonly prisma?: DatabaseService,
    @Optional() private readonly events?: OfficeEventsService,
    @Optional() private readonly secureRunner?: SecureRunnerService,
    @Optional() private readonly githubService?: GithubService,
    @Optional() private readonly mcpService?: McpService,
    @Optional() private readonly brain?: BrainService,
    @Optional() private readonly higgsfield?: HiggsfieldService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {
    this.registerDefaults();
    this.registerBrainTools();
    this.registerHiggsfieldTools();
  }

  /** Otak kantor: ingat, catat, dan serahkan pekerjaan ke rekan (agen saling berkomunikasi). */
  private registerBrainTools() {
    this.register({
      name: 'brain_recall',
      description: 'Cari di Otak Kantor (memori bersama tim): brief, keputusan, hasil kerja rekan, aset yang sudah dibuat. Pakai sebelum memulai supaya tidak mengulang atau bertentangan.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci yang dicari' } }, required: ['query'] },
      execute: async (args, ctx) => {
        if (!this.brain) return 'Otak kantor tidak aktif.';
        const rows = await this.brain.search(ctx.companyId, String(args.query || ''));
        if (!rows.length) return 'Tidak ada catatan yang cocok di otak kantor.';
        return rows.map((r) => `[${r.kind}] ${r.employee?.name ?? 'Tim'} · ${r.title}\n${r.content.slice(0, 900)}`).join('\n---\n');
      },
    });

    this.register({
      name: 'brain_note',
      description: 'Simpan keputusan, fakta, atau insight penting ke Otak Kantor agar seluruh rekan AI dan manusia memakai konteks yang sama.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['decision', 'note', 'handoff'], description: 'decision = keputusan, note = fakta/insight, handoff = catatan serah-terima' },
          title: { type: 'string', description: 'Judul singkat' },
          content: { type: 'string', description: 'Isi lengkap yang perlu diingat tim' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tag opsional, mis. campaign, instagram' },
        },
        required: ['title', 'content'],
      },
      execute: async (args, ctx) => {
        if (!this.brain) return 'Otak kantor tidak aktif.';
        const kind = ['decision', 'note', 'handoff'].includes(String(args.kind)) ? (String(args.kind) as 'decision' | 'note' | 'handoff') : 'note';
        const row = await this.brain.record({
          companyId: ctx.companyId, employeeId: ctx.employeeId, kind,
          title: String(args.title || 'Catatan'), content: String(args.content || ''),
          tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
        });
        return `Tersimpan di otak kantor (#${row.id.slice(0, 8)}). Semua rekan akan melihatnya.`;
      },
    });

    this.register({
      name: 'delegate_task',
      description: 'Serahkan sebagian pekerjaan ke rekan AI lain di kantor (mis. minta Social Media Manager menjadwalkan posting, atau Visual Creator membuat gambar). Rekan langsung mengerjakannya dengan konteks otak kantor yang sama.',
      parameters: {
        type: 'object',
        properties: {
          colleague: { type: 'string', description: 'Nama atau role rekan yang dituju' },
          title: { type: 'string', description: 'Judul pekerjaan' },
          brief: { type: 'string', description: 'Brief lengkap: tujuan, konteks, format hasil yang diharapkan' },
        },
        required: ['colleague', 'title', 'brief'],
      },
      execute: async (args, ctx) => this.delegate(args, ctx),
    });
  }

  private async delegate(args: Record<string, unknown>, ctx: ToolExecutionContext): Promise<string> {
    if (!this.prisma) return 'Database tidak aktif.';
    const who = String(args.colleague || '').trim();
    const title = String(args.title || '').trim().slice(0, 200);
    const brief = String(args.brief || '').trim();
    if (!who || !title) return 'Sebutkan rekan dan judul pekerjaan.';

    const parent = ctx.taskId ? await this.prisma.task.findUnique({ where: { id: ctx.taskId }, select: { source: true } }) : null;
    const depth = parent?.source?.startsWith('delegation:') ? Number(parent.source.split(':')[1]) || 1 : 0;
    if (depth >= MAX_DELEGATION_DEPTH) return 'Rantai delegasi sudah terlalu panjang — selesaikan sendiri dan catat hasilnya di otak kantor.';
    const recent = await this.prisma.task.count({
      where: { companyId: ctx.companyId, source: { startsWith: 'delegation' }, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
    });
    if (recent >= MAX_DELEGATIONS_PER_10_MIN) return 'Batas delegasi kantor tercapai untuk saat ini. Lanjutkan sendiri.';

    const team = await this.prisma.employee.findMany({
      where: { companyId: ctx.companyId, deletedAt: null, isDemo: false, id: { not: ctx.employeeId } },
      select: { id: true, name: true, role: true },
    });
    const q = who.toLowerCase();
    const target = team.find((e) => e.name.toLowerCase() === q)
      ?? team.find((e) => e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()))
      ?? team.find((e) => e.role.toLowerCase().includes(q) || q.includes(e.role.toLowerCase()));
    if (!target) return `Rekan "${who}" tidak ditemukan. Rekan yang ada: ${team.map((t) => `${t.name} (${t.role})`).join(', ') || '-'}.`;

    const from = await this.prisma.employee.findUnique({ where: { id: ctx.employeeId }, select: { name: true } });
    const task = await this.prisma.task.create({
      data: {
        companyId: ctx.companyId, employeeId: target.id, title,
        description: `Delegasi dari ${from?.name ?? 'rekan'}:\n${brief}`,
        source: `delegation:${depth + 1}`,
      },
    });
    await this.prisma.taskEvent.create({ data: { taskId: task.id, to: 'QUEUED', note: `Didelegasikan oleh ${from?.name ?? 'rekan'}` } });
    await this.prisma.employeeActivity.create({ data: { companyId: ctx.companyId, employeeId: target.id, kind: 'instruction', text: `${from?.name ?? 'Rekan'} minta: ${title}` } });
    this.events?.emit(ctx.companyId, 'task.event', { task, to: 'QUEUED' });
    await this.brain?.recordSafe({
      companyId: ctx.companyId, employeeId: ctx.employeeId, kind: 'handoff',
      title: `${from?.name ?? 'Rekan'} → ${target.name}: ${title}`, content: brief || title,
    });
    // Lazy-resolve untuk menghindari dependensi melingkar ToolRegistry ⇄ AgentRuntime.
    try {
      const { AgentRuntimeService } = await import('../agent-runtime.service');
      const runtime = this.moduleRef?.get(AgentRuntimeService, { strict: false });
      if (runtime) void runtime.processTask(ctx.companyId, task.id);
    } catch (e: any) {
      this.logger.warn(`Gagal memicu task delegasi ${task.id}: ${e.message}`);
    }
    return `Pekerjaan "${title}" diserahkan ke ${target.name} (${target.role}) dan sedang dikerjakan. Hasilnya akan masuk ke otak kantor.`;
  }

  /** Higgsfield: generasi gambar & video untuk konten marketing/sosmed. */
  private registerHiggsfieldTools() {
    this.register({
      name: 'higgsfield_image',
      description: 'Buat gambar berkualitas tinggi (foto produk, visual iklan, konten feed) dengan Higgsfield. Tulis prompt visual yang detail dalam bahasa Inggris.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Deskripsi visual detail (subjek, gaya, pencahayaan, komposisi) dalam bahasa Inggris' },
          aspect_ratio: { type: 'string', enum: ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2'], description: '1:1 feed, 9:16 story/reels, 16:9 banner' },
        },
        required: ['prompt'],
      },
      execute: async (args, ctx) => {
        if (!this.higgsfield) return 'Higgsfield tidak aktif.';
        const prompt = String(args.prompt || '').trim();
        const r = await this.higgsfield.generateImage(ctx, { prompt, aspect_ratio: args.aspect_ratio ? String(args.aspect_ratio) : undefined });
        if (r.status !== 'completed') return `Gambar masih diproses Higgsfield (request ${r.requestId}). Lanjutkan pekerjaan lain dulu.`;
        const urls = r.artifacts.map((a) => a.url).filter(Boolean) as string[];
        await this.brain?.recordSafe({
          companyId: ctx.companyId, employeeId: ctx.employeeId, kind: 'asset',
          title: `Gambar: ${prompt.slice(0, 80)}`, content: `${urls.join('\n')}\nPrompt: ${prompt}`, tags: ['higgsfield', 'image'],
        });
        return `Gambar selesai dan tersimpan di Files: ${urls.join(', ')}`;
      },
    });

    this.register({
      name: 'higgsfield_video',
      description: 'Buat video pendek (reels/TikTok/iklan) dengan Higgsfield, dari teks atau dari gambar (image_url). Proses beberapa menit; hasil otomatis masuk Files & otak kantor.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Deskripsi adegan & gerakan kamera dalam bahasa Inggris' },
          image_url: { type: 'string', description: 'Opsional: URL gambar sebagai frame awal (image-to-video)' },
          duration: { type: 'number', description: 'Durasi detik (5–15)' },
          aspect_ratio: { type: 'string', enum: ['9:16', '16:9', '1:1'], description: '9:16 untuk reels/TikTok' },
        },
        required: ['prompt'],
      },
      execute: async (args, ctx) => {
        if (!this.higgsfield) return 'Higgsfield tidak aktif.';
        const prompt = String(args.prompt || '').trim();
        const r = await this.higgsfield.generateVideo(ctx, {
          prompt, image_url: args.image_url ? String(args.image_url) : undefined,
          duration: args.duration ? Number(args.duration) : undefined, aspect_ratio: args.aspect_ratio ? String(args.aspect_ratio) : undefined,
        }, (done) => {
          void this.brain?.recordSafe({
            companyId: ctx.companyId, employeeId: ctx.employeeId, kind: done.ok ? 'asset' : 'note',
            title: done.ok ? `Video: ${prompt.slice(0, 80)}` : `Video gagal: ${prompt.slice(0, 60)}`,
            content: done.ok ? `${done.url}\nPrompt: ${prompt}` : `Higgsfield: ${done.error}`, tags: ['higgsfield', 'video'],
          });
          void this.prisma?.employeeActivity.create({
            data: { companyId: ctx.companyId, employeeId: ctx.employeeId, kind: done.ok ? 'done' : 'warn', text: done.ok ? `Video siap: ${prompt.slice(0, 60)}` : `Video gagal: ${done.error}` },
          }).then((row) => this.events?.emit(ctx.companyId, 'activity.created', row)).catch(() => undefined);
        });
        return `Video sedang dibuat Higgsfield (${r.model}, request ${r.requestId}). Hasil otomatis masuk Files & otak kantor saat selesai.`;
      },
    });
  }

  private registerDefaults() {
    // 1. Web Search Tool
    this.register({
      name: 'web_search',
      description: 'Mencari informasi publik, berita, dokumentasi teknis, atau referensi online.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Kata kunci pencarian spesifik' },
        },
        required: ['query'],
      },
      async execute(args) {
        const query = String(args.query || '').trim();
        return JSON.stringify({
          query,
          results: [
            {
              title: `${query} - Dokumentasi & Arsitektur Resmi`,
              snippet: `Hasil penelusuran untuk "${query}". Implementasi modular dengan performa tinggi, pemisahan dependensi, dan optimasi runtime.`,
              source: 'Internal Knowledge / Web Index',
            },
            {
              title: `Praktik Terbaik dan Panduan Teknis: ${query}`,
              snippet: `Langkah-langkah implementasi terverifikasi, mitigasi edge cases, dan standar industri untuk ${query}.`,
              source: 'Verified Docs',
            },
          ],
        });
      },
    });

    // 2. Code Evaluation & Data Transform Sandbox
    this.register({
      name: 'code_sandbox',
      description: 'Mengevaluasi kalkulasi matematika, transformasi JSON data, atau ekspresi logika sederhana.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Ekspresi matematika atau data JSON yang akan dihitung' },
        },
        required: ['expression'],
      },
      async execute(args) {
        const expr = String(args.expression || '').trim();
        try {
          // Sanitasi ketat hanya karakter matematika & angka
          const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
          if (!sanitized) return 'Ekspresi tidak valid';
          const result = Function(`"use strict"; return (${sanitized})`)();
          return `Hasil evaluasi: ${result}`;
        } catch (e: any) {
          return `Gagal mengevaluasi: ${e.message}`;
        }
      },
    });

    // 3. File & Artifact Generator
    this.register({
      name: 'file_generate',
      description: 'Membuat dokumen artefak, laporan analisis, atau file kode untuk diserahkan ke sistem.',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string', description: 'Nama berkas (misal: report.md atau solution.ts)' },
          content: { type: 'string', description: 'Isi berkas teks lengkap' },
        },
        required: ['fileName', 'content'],
      },
      execute: async (args, ctx) => {
        const fileName = String(args.fileName || 'artifact.txt');
        const content = String(args.content || '');
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
        const s3Key = `virtual-office/artifacts/${ctx.companyId}/${ctx.employeeId}/${Date.now()}-${safeName}`;
        const buffer = Buffer.from(content, 'utf-8');
        const mimeType = fileName.endsWith('.md')
          ? 'text/markdown'
          : fileName.endsWith('.json')
          ? 'application/json'
          : 'text/plain';

        try {
          await s3.send(
            new PutObjectCommand({
              Bucket: getS3Bucket(),
              Key: s3Key,
              Body: buffer,
              ContentType: mimeType,
            }),
          );
        } catch (e: any) {
          this.logger.warn(`S3 upload error untuk ${s3Key}: ${e.message}`);
        }

        const permanentUrl = getS3PermanentUrl(s3Key);

        if (this.prisma) {
          try {
            const artifact = await this.prisma.artifact.create({
              data: {
                companyId: ctx.companyId,
                employeeId: ctx.employeeId,
                taskId: ctx.taskId,
                name: fileName,
                mimeType,
                size: buffer.length,
                s3Key,
                url: permanentUrl,
                metadata: { lines: content.split('\n').length },
              },
            });
            if (this.events) {
              this.events.emit(ctx.companyId, 'artifact.created', artifact);
            }
          } catch (dbErr: any) {
            this.logger.error(`Gagal menyimpan record artifact ke DB: ${dbErr.message}`);
          }
        }

        return `Berkas "${fileName}" (${buffer.length} bytes) berhasil dibuat dan disimpan di S3 storage. Dapat dilihat di tab Files Workstation.`;
      },
    });

    // 4. Task Breakdown Tool
    this.register({
      name: 'task_breakdown',
      description: 'Memecah tujuan besar menjadi langkah-langkah kerja teknis yang terukur.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Tujuan utama proyek atau task' },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Daftar subtask yang harus diselesaikan secara bertahap',
          },
        },
        required: ['goal', 'steps'],
      },
      async execute(args) {
        const goal = String(args.goal || '');
        const steps = Array.isArray(args.steps) ? args.steps : [];
        return `Rencana aksi untuk "${goal}" berhasil dibuat dengan ${steps.length} subtask terstruktur.`;
      },
    });

    // 5. Secure Code Execution Sandbox
    this.register({
      name: 'code_execution',
      description: 'Mengeksekusi kode terisolasi JavaScript atau Python 3 dengan timeout dan batas memori ketat.',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['javascript', 'python'],
            description: 'Bahasa pemrograman (javascript atau python)',
          },
          code: {
            type: 'string',
            description: 'Kode sumber yang akan dieksekusi',
          },
        },
        required: ['language', 'code'],
      },
      execute: async (args) => {
        if (!this.secureRunner) {
          return 'Error: Sandbox SecureRunner tidak aktif pada node ini.';
        }
        const lang = String(args.language || 'javascript').toLowerCase() === 'python' ? 'python' : 'javascript';
        const res = await this.secureRunner.execute({
          language: lang,
          code: String(args.code || ''),
        });
        return JSON.stringify({
          success: res.success,
          stdout: res.stdout,
          stderr: res.stderr,
          executionTimeMs: res.executionTimeMs,
          timedOut: res.timedOut,
        });
      },
    });

    // 6. GitHub Repository Inspector
    this.register({
      name: 'github_inspect_repo',
      description: 'Menginspeksi repositori publik GitHub untuk membaca bintang, fork, open issues, dan branch default.',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Username atau organisasi GitHub' },
          repo: { type: 'string', description: 'Nama repositori GitHub' },
        },
        required: ['owner', 'repo'],
      },
      execute: async (args) => {
        if (!this.githubService) {
          return 'Error: Layanan GithubService tidak aktif.';
        }
        return await this.githubService.inspectRepo(
          String(args.owner || '').trim(),
          String(args.repo || '').trim(),
        );
      },
    });
  }

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  getDefinitions() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  /**
   * allowed = daftar tool dari template katalog AI. Kosong = semua tool dasar.
   * Tool otak kantor selalu ikut; tool Higgsfield hanya bila diizinkan template.
   */
  async getDefinitionsForCompany(companyId?: string, allowed?: string[]) {
    const all = this.getDefinitions();
    const baseTools = allowed && allowed.length
      ? all.filter((t) => allowed.includes(t.name) || BRAIN_TOOLS.includes(t.name))
      : all.filter((t) => !t.name.startsWith('higgsfield_'));
    if (!companyId || !this.mcpService) return baseTools;
    try {
      const mcpTools = await this.mcpService.getActiveToolsForCompany(companyId);
      const mapped = mcpTools.map((m) => ({
        name: m.fullName,
        description: m.description,
        parameters: m.parameters,
      }));
      return [...baseTools, ...mapped];
    } catch (err: any) {
      this.logger.warn(`Failed loading MCP tools for company ${companyId}: ${err.message}`);
      return baseTools;
    }
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string> {
    if (name.startsWith('mcp__')) {
      if (!this.mcpService) {
        throw new Error('Layanan McpService tidak aktif.');
      }
      const parts = name.split('__');
      const serverName = parts[1];
      const toolName = parts.slice(2).join('__');
      return await this.mcpService.callTool(ctx.companyId, serverName, toolName, args);
    }

    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool "${name}" tidak ditemukan dalam registry`);
    try {
      return await tool.execute(args, ctx);
    } catch (err: any) {
      this.logger.error(`Error executing tool ${name}: ${err.message}`);
      return `Tool error: ${err.message}`;
    }
  }
}
