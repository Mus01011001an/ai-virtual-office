import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { S3Service } from 'src/s3/s3.service';
import { getPresignedReadUrl, s3, getS3Bucket } from 'src/common/infrastructure/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { CreateArtifactDto, QueryArtifactsDto } from './dto/workstation.dto';

export interface UnifiedTraceMessage {
  id: string;
  type: 'instruction' | 'ai_reply' | 'discussion' | 'tool_call' | 'tool_output' | 'system' | 'activity';
  role: 'user' | 'assistant' | 'tool' | 'system';
  senderName: string;
  senderRole?: string;
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WorkstationService {
  private readonly logger = new Logger(WorkstationService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Mengumpulkan seluruh riwayat percakapan & trace eksekusi seorang AI Employee:
   * 1. Instruksi langsung dari CEO / User beserta respon AI.
   * 2. Pesan dari sesi diskusi multi-agent yang diikuti oleh employee ini.
   * 3. Riwayat eksekusi tool & aktivitas kognitif.
   */
  async getConversationTraces(companyId: string, employeeId: string, limit = 100): Promise<UnifiedTraceMessage[]> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, name: true, role: true },
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan');

    // 1. Ambil Employee Activities (instruksi, respon ai, tool, output)
    const activities = await this.prisma.employeeActivity.findMany({
      where: { companyId, employeeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 2. Ambil Diskusi yang diikuti oleh employee ini
    const discussions = await this.prisma.discussion.findMany({
      where: {
        companyId,
        participantIds: { has: employeeId },
      },
      select: { id: true },
      take: 20,
    });
    const discussionIds = discussions.map((d) => d.id);

    const discussionMessages = discussionIds.length > 0
      ? await this.prisma.discussionMessage.findMany({
          where: { discussionId: { in: discussionIds } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      : [];

    const traces: UnifiedTraceMessage[] = [];

    // Map activities
    for (const act of activities) {
      if (act.kind === 'instruction') {
        traces.push({
          id: act.id,
          type: 'instruction',
          role: 'user',
          senderName: 'CEO / User',
          text: act.text,
          createdAt: act.createdAt.toISOString(),
        });
      } else if (act.kind === 'ai') {
        traces.push({
          id: act.id,
          type: 'ai_reply',
          role: 'assistant',
          senderName: employee.name,
          senderRole: employee.role,
          text: act.text,
          createdAt: act.createdAt.toISOString(),
        });
      } else if (act.kind === 'tool') {
        traces.push({
          id: act.id,
          type: 'tool_call',
          role: 'tool',
          senderName: 'Tool Registry',
          text: act.text,
          createdAt: act.createdAt.toISOString(),
        });
      } else if (act.kind === 'output') {
        traces.push({
          id: act.id,
          type: 'tool_output',
          role: 'tool',
          senderName: 'Sandbox Output',
          text: act.text,
          createdAt: act.createdAt.toISOString(),
        });
      } else {
        traces.push({
          id: act.id,
          type: 'activity',
          role: 'system',
          senderName: 'System Monitor',
          text: act.text,
          createdAt: act.createdAt.toISOString(),
          metadata: { kind: act.kind },
        });
      }
    }

    // Map discussion messages
    for (const dm of discussionMessages) {
      const isFromThisEmp = dm.fromId === employeeId;
      traces.push({
        id: dm.id,
        type: 'discussion',
        role: dm.fromType === 'user' ? 'user' : dm.fromType === 'employee' ? 'assistant' : 'system',
        senderName: isFromThisEmp ? employee.name : (dm.fromType === 'user' ? 'CEO' : 'Rekan Tim'),
        senderRole: isFromThisEmp ? employee.role : undefined,
        text: dm.text,
        createdAt: dm.createdAt.toISOString(),
        metadata: { discussionId: dm.discussionId, isDemo: dm.isDemo },
      });
    }

    // Urutkan kronologis dari paling lama ke paling baru
    traces.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Batasi ke limit terakhir
    return traces.slice(-limit);
  }

  /**
   * Menampilkan daftar berkas / artefak hasil kerja agen.
   */
  async getArtifacts(companyId: string, query: QueryArtifactsDto) {
    const where: any = { companyId };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.taskId) where.taskId = query.taskId;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };

    const list = await this.prisma.artifact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        task: { select: { id: true, title: true } },
      },
    });

    // Tambahkan presigned download url segar untuk setiap berkas
    const results = await Promise.all(
      list.map(async (item) => {
        let downloadUrl = item.url || '';
        if (item.s3Key) {
          try {
            downloadUrl = await getPresignedReadUrl(item.s3Key, 3600);
          } catch {
            downloadUrl = item.url || '';
          }
        }
        return {
          ...item,
          downloadUrl,
        };
      }),
    );

    return { data: results, meta: { total: results.length } };
  }

  /**
   * Mendapatkan isi teks berkas artefak untuk preview langsung di HUD.
   */
  async getArtifactContent(companyId: string, id: string) {
    const artifact = await this.prisma.artifact.findFirst({
      where: { id, companyId },
      include: {
        employee: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
    if (!artifact) throw new NotFoundException('Berkas artefak tidak ditemukan');

    let content = '';
    if (artifact.s3Key) {
      try {
        const res = await s3.send(
          new GetObjectCommand({
            Bucket: getS3Bucket(),
            Key: artifact.s3Key,
          }),
        );
        content = await res.Body?.transformToString('utf-8') || '';
      } catch (err: any) {
        this.logger.warn(`Gagal membaca stream S3 untuk key ${artifact.s3Key}: ${err.message}`);
        content = `[Gagal mengunduh konten dari S3: ${err.message}]`;
      }
    }

    let downloadUrl = artifact.url || '';
    if (artifact.s3Key) {
      downloadUrl = await getPresignedReadUrl(artifact.s3Key, 3600).catch(() => artifact.url || '');
    }

    return {
      id: artifact.id,
      name: artifact.name,
      mimeType: artifact.mimeType,
      size: artifact.size,
      content,
      downloadUrl,
      createdAt: artifact.createdAt,
      employee: artifact.employee,
      task: artifact.task,
    };
  }

  /**
   * Membuat artefak baru (manual generate atau API upload).
   */
  async createArtifact(companyId: string, dto: CreateArtifactDto) {
    const buffer = Buffer.from(dto.content, 'utf-8');
    const safeName = dto.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const mimeType = dto.mimeType || (dto.name.endsWith('.md') ? 'text/markdown' : 'text/plain');

    let s3Key = '';
    let publicUrl = '';

    try {
      const uploadRes = await this.s3Service.uploadFile({
        buffer,
        originalname: safeName,
        mimetype: mimeType,
        size: buffer.length,
      });
      s3Key = uploadRes.data.filename;
      publicUrl = uploadRes.data.url;
    } catch (err: any) {
      this.logger.warn(`S3 upload fallback ke local database: ${err.message}`);
      s3Key = `local/${Date.now()}-${safeName}`;
      publicUrl = '';
    }

    const artifact = await this.prisma.artifact.create({
      data: {
        companyId,
        employeeId: dto.employeeId || null,
        taskId: dto.taskId || null,
        name: dto.name,
        mimeType,
        size: buffer.length,
        s3Key,
        url: publicUrl,
        metadata: {
          characterCount: dto.content.length,
          lines: dto.content.split('\n').length,
        },
      },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        task: { select: { id: true, title: true } },
      },
    });

    this.events.emit(companyId, 'artifact.created', artifact);

    return artifact;
  }

  /**
   * Menghitung analitik kinerja, token ledger, dan estimasi biaya.
   */
  async getPerformance(companyId: string, employeeId?: string) {
    const where: any = { companyId };
    if (employeeId) where.employeeId = employeeId;

    // 1. Data penggunaan token dari UsageRecord
    const records = await this.prisma.usageRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        employee: { select: { id: true, name: true, role: true } },
        task: { select: { id: true, title: true } },
      },
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalEstimatedCostUsd = 0;
    let totalDurationMs = 0;

    const modelMap = new Map<string, { model: string; totalTokens: number; cost: number; count: number }>();

    for (const r of records) {
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      totalTokens += r.totalTokens;
      totalEstimatedCostUsd += r.estimatedCost;
      totalDurationMs += r.durationMs;

      const modelKey = r.model || 'unknown';
      const cur = modelMap.get(modelKey) || { model: modelKey, totalTokens: 0, cost: 0, count: 0 };
      cur.totalTokens += r.totalTokens;
      cur.cost += r.estimatedCost;
      cur.count += 1;
      modelMap.set(modelKey, cur);
    }

    const totalInvocations = records.length;
    const avgDurationMs = totalInvocations > 0 ? Math.round(totalDurationMs / totalInvocations) : 0;
    const totalEstimatedCostIdr = Math.round(totalEstimatedCostUsd * 16300);

    // 2. Data Task summary
    const taskWhere: any = { companyId };
    if (employeeId) taskWhere.employeeId = employeeId;

    const [totalTasks, completedTasks, failedTasks, executingTasks] = await Promise.all([
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'FAILED' } }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'EXECUTING' } }),
    ]);

    const finished = completedTasks + failedTasks;
    const successRate = finished > 0 ? Math.round((completedTasks / finished) * 100) : 100;

    return {
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalTokens,
      },
      cost: {
        usd: Number(totalEstimatedCostUsd.toFixed(4)),
        idr: totalEstimatedCostIdr,
      },
      latency: {
        avgDurationMs,
        totalInvocations,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        executing: executingTasks,
        successRate,
      },
      byModel: Array.from(modelMap.values()),
      recentRecords: records.slice(0, 20),
    };
  }
}
