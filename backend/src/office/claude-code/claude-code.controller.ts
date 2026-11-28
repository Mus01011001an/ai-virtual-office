import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_EMPLOYEE_INSTRUCT, P_EMPLOYEE_READ } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { ClaudeCodeService } from './claude-code.service';

/** Jembatan hook Claude Code → Office Baru. Script hook: frontend/tools/office-new/claude-hook.mjs. */
@ApiTags('Office - Claude Code hooks')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_EMPLOYEE_READ)
@Controller('office/claude-code')
export class ClaudeCodeController {
  constructor(private readonly claude: ClaudeCodeService) {}

  /** Body: JSON stdin hook Claude Code (satu objek atau array). Selalu cepat; tidak memanggil model. */
  @Post('events')
  @HttpCode(202)
  @Permission(P_EMPLOYEE_INSTRUCT)
  ingest(@ActiveCompany() companyId: string, @Body() body: unknown) {
    return { accepted: this.claude.ingest(companyId, body) };
  }

  @Get('events')
  recent(@ActiveCompany() companyId: string, @Query('since') since?: string) {
    return this.claude.recent(companyId, since ? Number(since) : undefined);
  }

  @Get('team')
  team(@ActiveCompany() companyId: string) {
    return { team: this.claude.team(companyId), skills: this.claude.skills(companyId) };
  }
}
