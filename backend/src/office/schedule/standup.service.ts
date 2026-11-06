import { Injectable, Logger, Optional } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { WebhookNotificationService } from '../integrations/webhook-notification.service';

export interface StandupItemReport {
  employeeId: string;
  name: string;
  yesterday: string;
  today: string;
  blockers: string;
}

@Injectable()
export class StandupService {
  private readonly logger = new Logger(StandupService.name);
  private activeStandups = new Set<string>();

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly aiEngine: AiEngineService,
    @Optional() private readonly webhooks?: WebhookNotificationService,
  ) {}

  async triggerStandup(companyId: string, triggerSource: string = 'manual') {
    if (this.activeStandups.has(companyId)) {
      this.logger.warn(`Standup already running for company ${companyId}`);
      return { status: 'ALREADY_RUNNING', message: 'Daily standup sedang berlangsung' };
    }
    this.activeStandups.add(companyId);

    try {
      const today = new Date().toISOString().split('T')[0];
      this.logger.log(`Starting Daily Standup for company ${companyId} on ${today} (source: ${triggerSource})`);

      // 1. Ambil seluruh employee aktif
      const employees = await this.prisma.employee.findMany({
        where: { companyId, deletedAt: null },
        include: { aiProvider: true },
      });

      if (!employees.length) {
        return { status: 'NO_EMPLOYEES', message: 'Tidak ada employee aktif' };
      }

      const participantIds = employees.map((e) => e.id);

      // 2. Broadcast event standup.started ke frontend (agar agen kumpul ke collab pod)
      this.events.emit(companyId, 'standup.started', {
        date: today,
        participantIds,
        location: 'collab',
      });

      // Ubah status agen ke IN_MEETING
      await this.prisma.employee.updateMany({
        where: { id: { in: participantIds }, companyId },
        data: { status: 'IN_MEETING', currentTask: 'Daily Standup Pagi' },
      });

      const reports: StandupItemReport[] = [];

      // 3. Iterasi setiap employee untuk menyusun laporan 3 butir (Yesterday, Today, Blockers)
      for (const emp of employees) {
        // Ambil riwayat tugas 24 jam terakhir
        const recentTasks = await this.prisma.task.findMany({
          where: { employeeId: emp.id, companyId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        });

        const completedTitles =
          recentTasks
            .filter((t) => t.status === 'COMPLETED')
            .map((t) => t.title)
            .join(', ') || 'Riset arsitektur dan pemeliharaan modul';

        const pendingTitles =
          recentTasks
            .filter((t) => t.status === 'QUEUED' || t.status === 'EXECUTING')
            .map((t) => t.title)
            .join(', ') || 'Standby antrean instruksi dan pemantauan sistem';

        let empReport = {
          yesterday: completedTitles,
          today: pendingTitles,
          blockers: 'Tidak ada blocker teknis.',
        };

        // Jika memiliki provider aktif, minta LLM membuat narasi profesional
        if (emp.aiProvider && emp.aiProvider.isActive && emp.model) {
          try {
            const prompt = `Kamu adalah ${emp.name}, ${emp.role} di departemen ${emp.department}.
Saat ini adalah Daily Standup pagi kantor. Berikan laporan standup singkat padat dalam format JSON:
{
  "yesterday": "1 kalimat apa yang kamu kerjakan kemarin",
  "today": "1 kalimat fokus utama yang akan kamu kerjakan hari ini",
  "blockers": "1 kalimat kendala (jika lancar tulis 'Tidak ada kendala')"
}
Konteks tugas kemarin: ${completedTitles}
Konteks tugas hari ini: ${pendingTitles}`;

            const res = await this.aiEngine.generateForEmployee(companyId, emp.id, prompt, {
              temperature: 0.6,
              maxTokens: 250,
            });

            const jsonMatch = res.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              empReport = {
                yesterday: parsed.yesterday || empReport.yesterday,
                today: parsed.today || empReport.today,
                blockers: parsed.blockers || empReport.blockers,
              };
            }
          } catch (err: any) {
            this.logger.warn(`Fallback heuristic standup report for ${emp.name}: ${err.message}`);
          }
        }

        const reportItem: StandupItemReport = {
          employeeId: emp.id,
          name: emp.name,
          ...empReport,
        };
        reports.push(reportItem);

        // Siarkan item report via SSE
        this.events.emit(companyId, 'standup.item', {
          date: today,
          report: reportItem,
        });

        // Delay kecil agar terasa bertahap di UI
        await new Promise((r) => setTimeout(r, 600));
      }

      // 4. Buat rangkuman Markdown
      const summaryText =
        `# Daily Standup Report — ${today}\n\n` +
        reports
          .map(
            (r) =>
              `### 👤 ${r.name}\n- **Kemarin**: ${r.yesterday}\n- **Hari Ini**: ${r.today}\n- **Kendala**: ${r.blockers}`,
          )
          .join('\n\n');

      // Simpan ke database
      const standupRecord = await this.prisma.standupReport.create({
        data: {
          companyId,
          date: today,
          summary: summaryText,
          attendees: participantIds,
          reports: reports as any,
        },
      });

      // Catat activity log
      await this.prisma.employeeActivity.create({
        data: {
          companyId,
          employeeId: employees[0].id,
          kind: 'info',
          text: `Daily Standup pagi (${today}) selesai untuk ${reports.length} anggota tim.`,
        },
      });

      // 5. Siarkan penyelesaian standup
      this.events.emit(companyId, 'standup.completed', {
        id: standupRecord.id,
        date: today,
        summary: summaryText,
        reports,
      });

      if (this.webhooks) {
        this.webhooks.dispatch({
          companyId,
          event: 'standup.completed',
          title: `Daily Standup Selesai (${today})`,
          summary: summaryText.slice(0, 500) + '...',
          data: { standupId: standupRecord.id, date: today, attendeesCount: participantIds.length },
        });
      }

      // Kembalikan status agen ke IDLE
      await this.prisma.employee.updateMany({
        where: { id: { in: participantIds }, companyId },
        data: { status: 'IDLE', currentTask: null },
      });

      return {
        status: 'SUCCESS',
        standupId: standupRecord.id,
        date: today,
        participantsCount: reports.length,
      };
    } finally {
      this.activeStandups.delete(companyId);
    }
  }

  async getLatestStandup(companyId: string) {
    return this.prisma.standupReport.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStandupHistory(companyId: string, limit = 10) {
    return this.prisma.standupReport.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
