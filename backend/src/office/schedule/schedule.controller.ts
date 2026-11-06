import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { ScheduleService } from './schedule.service';
import { StandupService } from './standup.service';
import { FastForwardScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';

@ApiTags('office-schedule')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/schedule')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly standupService: StandupService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mendapatkan konfigurasi shift dan status jadwal kantor saat ini' })
  async getSchedule(@ActiveCompany() companyId: string) {
    return this.scheduleService.getSchedule(companyId);
  }

  @Patch()
  @ApiOperation({ summary: 'Memperbarui konfigurasi jadwal kantor (jam kerja, istirahat, timezone)' })
  async updateSchedule(
    @ActiveCompany() companyId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.scheduleService.updateSchedule(companyId, dto);
  }

  @Post('fast-forward')
  @ApiOperation({ summary: 'Simulasi percepatan waktu (Fast-Forward) untuk menguji transisi shift' })
  async fastForward(
    @ActiveCompany() companyId: string,
    @Body() dto: FastForwardScheduleDto,
  ) {
    const profile = await this.scheduleService.getSchedule(companyId);
    return this.scheduleService.evaluateCompanySchedule(profile, dto.clock);
  }

  @Post('standup/trigger')
  @ApiOperation({ summary: 'Memicu upacara Daily Standup pagi secara langsung' })
  async triggerStandup(@ActiveCompany() companyId: string) {
    return this.standupService.triggerStandup(companyId, 'manual_ui');
  }

  @Get('standup/latest')
  @ApiOperation({ summary: 'Mendapatkan laporan Daily Standup terbaru' })
  async getLatestStandup(@ActiveCompany() companyId: string) {
    return this.standupService.getLatestStandup(companyId);
  }

  @Get('standup/history')
  @ApiOperation({ summary: 'Mendapatkan riwayat Daily Standup kantor' })
  async getStandupHistory(
    @ActiveCompany() companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.standupService.getStandupHistory(companyId, limit ? parseInt(limit, 10) : 10);
  }
}
