import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany, ActiveUser } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { PresenceService } from './presence.service';
import { UpdatePresenceDto } from './dto/presence.dto';

@ApiTags('office-presence')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post()
  @ApiOperation({ summary: 'Memperbarui koordinat posisi dan animasi avatar user lokal di 3D' })
  updatePresence(
    @ActiveCompany() companyId: string,
    @ActiveUser() user: any,
    @Body() dto: UpdatePresenceDto,
  ) {
    return this.presenceService.updatePresence(
      companyId,
      { id: user.id, name: user.name, role: user.role || user.activeRole?.name || 'MEMBER' },
      dto,
    );
  }

  @Get('online')
  @ApiOperation({ summary: 'Mendapatkan daftar seluruh user yang sedang online di kantor ini' })
  getOnlineUsers(@ActiveCompany() companyId: string) {
    return this.presenceService.getOnlineUsers(companyId);
  }

  @Post('leave')
  @ApiOperation({ summary: 'Menghapus kehadiran user saat logout atau berpindah kantor' })
  leavePresence(@ActiveCompany() companyId: string, @ActiveUser() user: any) {
    this.presenceService.removeUser(companyId, user.id);
    return { success: true };
  }

  @Post('voice-signal')
  @ApiOperation({ summary: 'Relay WebRTC voice signaling (offer, answer, ice-candidate) antar peer' })
  relayVoiceSignal(
    @ActiveCompany() companyId: string,
    @ActiveUser() user: any,
    @Body() body: { toUserId?: string; signal: any },
  ) {
    return this.presenceService.relayVoiceSignal(companyId, user.id, body);
  }
}
