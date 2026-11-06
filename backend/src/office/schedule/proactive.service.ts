import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { AgentRuntimeService } from '../ai-engine/agent-runtime.service';

@Injectable()
export class ProactiveService {
  private readonly logger = new Logger(ProactiveService.name);
  private lastEvaluation = new Map<string, number>();

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly aiEngine: AiEngineService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  /**
   * Mengevaluasi karyawan yang IDLE untuk mengajukan inisiatif proaktif.
   * Dibatasi agar tidak membanjiri antrean (maksimal 1 evaluasi tiap 15 menit per company).
   */
  async evaluateIdleAgents(companyId: string) {
    const last = this.lastEvaluation.get(companyId) || 0;
    const now = Date.now();
    if (now - last < 15 * 60 * 1000) {
      return;
    }
    this.lastEvaluation.set(companyId, now);

    try {
      // Cari employee non-demo yang sedang IDLE dan belum punya task pending/executing
      const idleEmployees = await this.prisma.employee.findMany({
        where: {
          companyId,
          status: 'IDLE',
          deletedAt: null,
          isDemo: false,
        },
        include: { aiProvider: true },
      });

      if (!idleEmployees.length) return;

      // Pilih 1 karyawan acak untuk memunculkan inisiatif
      const candidate = idleEmployees[Math.floor(Math.random() * idleEmployees.length)];

      // Cek apakah karyawan ini sudah membuat inisiatif hari ini
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingToday = await this.prisma.task.count({
        where: {
          companyId,
          employeeId: candidate.id,
          source: 'proactive',
          createdAt: { gte: startOfDay },
        },
      });

      if (existingToday >= 2) return; // Batasi maksimal 2 inisiatif per hari

      this.logger.log(`Generating proactive initiative for ${candidate.name} (${candidate.role})`);

      let initiativeTitle = `Audit dan optimasi modul ${candidate.department}`;
      let initiativeDesc = `Inisiatif mandiri dari ${candidate.name} untuk memelihara performa dan reliabilitas modul ${candidate.department}.`;

      if (candidate.aiProvider && candidate.aiProvider.isActive && candidate.model) {
        try {
          const prompt = `Kamu adalah ${candidate.name}, ${candidate.role} di departemen ${candidate.department}.
Saat ini kamu sedang tidak ada penugasan dari CEO. Sebagai profesional otonom, usulkan 1 inisiatif atau perbaikan teknis nyata yang relevan untuk dikerjakan.
Format JSON:
{
  "title": "Judul inisiatif singkat (maks 8 kata)",
  "description": "Deskripsi singkat rencana aksi (1-2 kalimat)"
}`;

          const res = await this.aiEngine.generateForEmployee(companyId, candidate.id, prompt, {
            temperature: 0.7,
            maxTokens: 200,
          });

          const jsonMatch = res.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.title) initiativeTitle = `[INISIATIF] ${parsed.title}`;
            if (parsed.description) initiativeDesc = parsed.description;
          }
        } catch (err: any) {
          this.logger.warn(`AI proactive proposal fallback for ${candidate.name}: ${err.message}`);
          initiativeTitle = `[INISIATIF] Optimasi modul ${candidate.department}`;
        }
      }

      // Buat task inisiatif di database
      const task = await this.prisma.task.create({
        data: {
          companyId,
          employeeId: candidate.id,
          title: initiativeTitle,
          description: initiativeDesc,
          status: 'QUEUED',
          source: 'proactive',
        },
      });

      // Catat event task & employee activity
      await this.prisma.taskEvent.create({
        data: {
          taskId: task.id,
          to: 'QUEUED',
          note: `Inisiatif otonom dibuat oleh ${candidate.name}`,
        },
      });

      await this.prisma.employeeActivity.create({
        data: {
          companyId,
          employeeId: candidate.id,
          kind: 'info',
          text: `Mengajukan inisiatif kerja: "${initiativeTitle}"`,
        },
      });

      this.events.emit(companyId, 'task.event', { task, event: 'created' });

      // Langsung eksekusi task otonom jika agent runtime siap
      void this.agentRuntime.processTask(companyId, task.id);
    } catch (err: any) {
      this.logger.error(`Error in evaluateIdleAgents: ${err.message}`);
    }
  }
}
