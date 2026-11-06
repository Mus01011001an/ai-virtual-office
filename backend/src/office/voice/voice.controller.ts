import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { VoiceProfileDto, VoiceService } from './voice.service';

@ApiTags('office-voice')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('profiles')
  @ApiOperation({ summary: 'Mendapatkan daftar profil vokal seluruh karyawan virtual' })
  async getVoiceProfiles(@ActiveCompany() companyId: string) {
    return this.voiceService.getVoiceProfiles(companyId);
  }

  @Patch('profiles/:employeeId')
  @ApiOperation({ summary: 'Memperbarui profil suara vokal (pitch, rate, gender) karyawan' })
  async updateVoiceProfile(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: VoiceProfileDto,
  ) {
    return this.voiceService.updateVoiceProfile(companyId, employeeId, dto);
  }
}
