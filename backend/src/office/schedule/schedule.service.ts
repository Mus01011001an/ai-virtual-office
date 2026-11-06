import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { StandupService } from './standup.service';
import { ProactiveService } from './proactive.service';
import { UpdateScheduleDto } from './dto/schedule.dto';

export interface ScheduleStatus {
  kind: 'work' | 'break' | 'closed';
  label: string;
  nextEvent: string;
  currentBreakName?: string;
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly standupService: StandupService,
    private readonly proactiveService: ProactiveService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleMinuteTick() {
    try {
      const profiles = await this.prisma.officeProfile.findMany({
        include: { company: true },
      });

      for (const profile of profiles) {
        if (profile.company?.deletedAt) continue;
        await this.evaluateCompanySchedule(profile);
      }
    } catch (err: any) {
      this.logger.error(`Error in handleMinuteTick: ${err.message}`);
    }
  }

  async evaluateCompanySchedule(profile: any, forceClock?: string) {
    const tz = profile.timezone || 'Asia/Jakarta';
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '00';
    const currentClock = forceClock || `${hourStr}:${minStr}`;
    const weekdayNum = now.getDay();

    const status = this.calculateShiftState(profile, currentClock, weekdayNum);

    // 1. Cek pemicu Standup Harian (jika tepat jam standup dan autoStandupEnabled aktif)
    if (profile.autoStandupEnabled && currentClock === profile.standupTime) {
      void this.standupService.triggerStandup(profile.companyId, 'cron');
    }

    // 2. Siarkan event status shift ke SSE
    this.events.emit(profile.companyId, 'schedule.transition', {
      clock: currentClock,
      timezone: tz,
      status,
    });

    // 3. Terapkan transisi status fisik ke employee non-demo
    await this.applyScheduleToEmployees(profile.companyId, status);

    // 4. Picu inisiatif proaktif jika kantor sedang jam kerja aktif
    if (status.kind === 'work' && profile.proactiveEnabled) {
      void this.proactiveService.evaluateIdleAgents(profile.companyId);
    }

    return {
      clock: currentClock,
      timezone: tz,
      status,
    };
  }

  calculateShiftState(profile: any, clock: string, weekday: number): ScheduleStatus {
    const workdays = Array.isArray(profile.workdays) ? profile.workdays : [1, 2, 3, 4, 5];
    if (!workdays.includes(weekday)) {
      return { kind: 'closed', label: 'Libur Akhir Pekan', nextEvent: `Buka hari kerja ${profile.workStart}` };
    }

    if (clock < profile.workStart || clock >= profile.workEnd) {
      return { kind: 'closed', label: 'Kantor Tutup', nextEvent: `Buka ${profile.workStart}` };
    }

    const breaks = Array.isArray(profile.breaks) ? profile.breaks : [];
    const activeBreak = breaks.find((b: any) => clock >= b.start && clock < b.end);
    if (activeBreak) {
      return {
        kind: 'break',
        label: activeBreak.name || 'Istirahat',
        nextEvent: `Kembali kerja ${activeBreak.end}`,
        currentBreakName: activeBreak.name,
      };
    }

    const upcomingBreak = breaks.find((b: any) => b.start > clock);
    const nextLabel = upcomingBreak
      ? `${upcomingBreak.name} jam ${upcomingBreak.start}`
      : `Tutup ${profile.workEnd}`;

    return { kind: 'work', label: 'Jam Kerja Aktif', nextEvent: nextLabel };
  }

  private async applyScheduleToEmployees(companyId: string, status: ScheduleStatus) {
    try {
      if (status.kind === 'closed') {
        // Kantor tutup: agen yang IDLE / ON_BREAK beralih ke OFFLINE
        await this.prisma.employee.updateMany({
          where: { companyId, status: { in: ['IDLE', 'ON_BREAK'] }, isDemo: false },
          data: { status: 'OFFLINE', slot: null, currentTask: null, currentTool: null },
        });
      } else if (status.kind === 'break') {
        // Waktu istirahat: agen yang IDLE beralih ke ON_BREAK
        await this.prisma.employee.updateMany({
          where: { companyId, status: 'IDLE', isDemo: false },
          data: { status: 'ON_BREAK', currentTask: status.currentBreakName || 'Istirahat' },
        });
      } else if (status.kind === 'work') {
        // Jam kerja: agen yang tadinya ON_BREAK atau OFFLINE kembali ke IDLE
        await this.prisma.employee.updateMany({
          where: { companyId, status: { in: ['ON_BREAK', 'OFFLINE'] }, isDemo: false },
          data: { status: 'IDLE', currentTask: null },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error applying schedule to employees: ${err.message}`);
    }
  }

  async getSchedule(companyId: string) {
    let profile = await this.prisma.officeProfile.findUnique({
      where: { companyId },
    });

    if (!profile) {
      profile = await this.prisma.officeProfile.create({
        data: { companyId },
      });
    }

    const now = new Date();
    const tz = profile.timezone || 'Asia/Jakarta';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '00';
    const clock = `${hourStr}:${minStr}`;

    const currentShift = this.calculateShiftState(profile, clock, now.getDay());

    return {
      id: profile.id,
      companyId: profile.companyId,
      timezone: profile.timezone,
      workStart: profile.workStart,
      workEnd: profile.workEnd,
      workdays: profile.workdays,
      breaks: profile.breaks,
      standupTime: profile.standupTime,
      autoStandupEnabled: profile.autoStandupEnabled,
      proactiveEnabled: profile.proactiveEnabled,
      clock,
      currentShift,
    };
  }

  async updateSchedule(companyId: string, dto: UpdateScheduleDto) {
    const updated = await this.prisma.officeProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        timezone: dto.timezone || 'Asia/Jakarta',
        workStart: dto.workStart || '09:00',
        workEnd: dto.workEnd || '18:00',
        workdays: dto.workdays || [1, 2, 3, 4, 5],
        breaks: dto.breaks || ([
          { name: 'Coffee break', start: '10:30', end: '10:45' },
          { name: 'Istirahat siang', start: '12:00', end: '13:00' },
          { name: 'Afternoon break', start: '15:30', end: '15:45' },
        ] as any),
        standupTime: dto.standupTime || '09:00',
        autoStandupEnabled: dto.autoStandupEnabled ?? true,
        proactiveEnabled: dto.proactiveEnabled ?? true,
      },
      update: {
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.workStart ? { workStart: dto.workStart } : {}),
        ...(dto.workEnd ? { workEnd: dto.workEnd } : {}),
        ...(dto.workdays ? { workdays: dto.workdays } : {}),
        ...(dto.breaks ? { breaks: dto.breaks as any } : {}),
        ...(dto.standupTime ? { standupTime: dto.standupTime } : {}),
        ...(dto.autoStandupEnabled !== undefined ? { autoStandupEnabled: dto.autoStandupEnabled } : {}),
        ...(dto.proactiveEnabled !== undefined ? { proactiveEnabled: dto.proactiveEnabled } : {}),
      },
    });

    // Evaluasi ulang jadwal segera
    await this.evaluateCompanySchedule(updated);
    return updated;
  }
}
