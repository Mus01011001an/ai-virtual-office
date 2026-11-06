import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { AgentBundleService } from './agent-bundle.service';

export interface ContextWindowStatus {
  employeeId: string;
  sessionIndex: number;
  totalTokensUsed: number;
  maxContextTokens: number;
  usagePercentage: number;
  shouldReset: boolean;
  statusLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  currentActiveTask: {
    id?: string;
    title?: string;
    status?: string;
    progress?: number;
  } | null;
  recentAchievements: string[];
  pastMemoriesCount: number;
  accumulatedSummaryPreview: string;
}

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);
  private readonly DEFAULT_MAX_TOKENS = 128000; // Standar konteks 128k (OpenAI / Claude / Gemini)

  constructor(
    private readonly prisma: DatabaseService,
    private readonly bundleService: AgentBundleService,
  ) {}

  /**
   * Menghitung status context window agent secara realtime dan memberikan rekomendasi reset.
   */
  async getContextStatus(companyId: string, employeeId: string): Promise<ContextWindowStatus> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        tasks: {
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        sessionMemories: {
          where: { companyId },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan');

    // Ambil total token penggunaan sesi aktif dari UsageRecord
    const usage = await this.prisma.usageRecord.aggregate({
      where: {
        employeeId,
        companyId,
      },
      _sum: {
        totalTokens: true,
      },
    });

    const totalTokensUsed = usage._sum.totalTokens || (employee.systemPrompt.length / 4);
    const maxTokens = this.DEFAULT_MAX_TOKENS;
    const usagePercentage = Math.min(100, Math.round((totalTokensUsed / maxTokens) * 100));

    let statusLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (usagePercentage >= 85) statusLevel = 'CRITICAL';
    else if (usagePercentage >= 75) statusLevel = 'HIGH';
    else if (usagePercentage >= 45) statusLevel = 'MODERATE';

    const shouldReset = usagePercentage >= 75 || employee.tasks.filter((t) => t.status === 'COMPLETED').length >= 15;

    // Task yang sedang aktif dikerjakan
    const activeTask = employee.tasks.find((t) => t.status === 'EXECUTING' || t.status === 'WAITING') || null;

    // Capaian tugas terbaru di sesi ini
    const recentAchievements = employee.tasks
      .filter((t) => t.status === 'COMPLETED')
      .slice(0, 5)
      .map((t) => t.title);

    return {
      employeeId,
      sessionIndex: employee.activeSessionIndex,
      totalTokensUsed,
      maxContextTokens: maxTokens,
      usagePercentage,
      shouldReset,
      statusLevel,
      currentActiveTask: activeTask
        ? {
            id: activeTask.id,
            title: activeTask.title,
            status: activeTask.status,
            progress: employee.progress,
          }
        : null,
      recentAchievements,
      pastMemoriesCount: employee.sessionMemories.length,
      accumulatedSummaryPreview: employee.accumulatedSummary || 'Belum ada ringkasan sesi lampau.',
    };
  }

  /**
   * Melakukan kompresi sesi aktif menjadi memori episodik permanen dan mereset active session.
   * "jgn sampe klo direset jadi hilang semua yg dia ingat. harusnya semua dia nyimpan historynya kan ngapain aja"
   */
  async compactSession(companyId: string, employeeId: string, resetReason = 'manual_reset') {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        tasks: {
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        artifacts: {
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan');

    const completedTasks = employee.tasks.filter((t) => t.status === 'COMPLETED');
    const createdArtifacts = employee.artifacts;

    // Rangkuman milestone terstruktur yang akan diingat selamanya
    const nowStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const tasksSummary = completedTasks.length > 0
      ? completedTasks.map((t) => `- [Selesai] ${t.title}`).join('\n')
      : '- Menyelesaikan sesi kerja dan koordinasi rutin.';

    const artifactsSummary = createdArtifacts.length > 0
      ? createdArtifacts.map((a) => `- Artefak "${a.name}" (${a.mimeType})`).join('\n')
      : '- Tidak ada berkas file baru yang disimpan.';

    const sessionSummary = `
### Milestone Sesi #${employee.activeSessionIndex} (${nowStr})
- **Alasan Kompresi**: ${resetReason}
- **Tugas Utama yang Telah Selesai**:
${tasksSummary}
- **Artefak & Berkas yang Dihasilkan**:
${artifactsSummary}
`.trim();

    // 1. Simpan ke tabel log memori permanen
    await this.prisma.agentSessionMemory.create({
      data: {
        employeeId,
        companyId,
        sessionIndex: employee.activeSessionIndex,
        summaryContext: sessionSummary,
        tokenCount: Math.round(sessionSummary.length / 4),
        resetReason,
        lastTaskTitle: completedTasks[0]?.title || employee.currentTask || 'Koordinasi Sesi',
      },
    });

    // 2. Gabungkan ke accumulatedSummary milik Employee
    const updatedAccumulated = employee.accumulatedSummary
      ? `${employee.accumulatedSummary.trim()}\n\n---\n${sessionSummary}`
      : sessionSummary;

    // 3. Naikkan index sesi aktif dan simpan ringkasan
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        activeSessionIndex: employee.activeSessionIndex + 1,
        accumulatedSummary: updatedAccumulated,
        progress: 0,
      },
    });

    // 4. Kompilasi ulang prompt Antigravity agar memori baru langsung masuk ke <episodic_memory>
    await this.bundleService.compilePrompt(companyId, employeeId);

    this.logger.log(`Berhasil melakukan kompresi memori sesi #${employee.activeSessionIndex} untuk ${employee.name}`);

    return {
      success: true,
      message: `Sesi #${employee.activeSessionIndex} berhasil dirangkum. Memori permanen telah diperbarui dan konteks aktif disegarkan.`,
      newSessionIndex: employee.activeSessionIndex + 1,
    };
  }
}
