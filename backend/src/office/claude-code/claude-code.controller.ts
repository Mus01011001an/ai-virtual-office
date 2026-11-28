import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_EMPLOYEE_INSTRUCT, P_EMPLOYEE_READ } from 'src/common/constants/permissions';
import { ActiveCompany, ActiveUser } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { ClaudeCodeService, type Sender } from './claude-code.service';

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

  // ---------------------------------------------------------------- office → Claude Code (dua arah)
  // docs/ai-office-claude-code.md §Dua arah. Perintah hanya dari pemilik runner (atau semua anggota bila --team).

  /** Status runner untuk pengguna ini (online, sibuk, milik saya?). */
  @Get('runner')
  runner(@ActiveCompany() companyId: string, @ActiveUser() user: Sender) {
    return this.claude.runnerStatus(companyId, user.id);
  }

  @Get('commands')
  commands(@ActiveCompany() companyId: string) {
    return this.claude.recentCommands(companyId);
  }

  /** Office: tugas baru (`task`) atau chat ke satu karyawan (`chat`). */
  @Post('commands')
  @Permission(P_EMPLOYEE_INSTRUCT)
  send(@ActiveCompany() companyId: string, @ActiveUser() user: Sender, @Body() body: { kind?: string; text?: string; to?: string; toName?: string }) {
    return this.claude.enqueue(companyId, user, body ?? {});
  }

  /** Runner (long-poll ±25 dtk): perintah berikutnya atau `{ command: null }`. */
  @Get('runner/next')
  @Permission(P_EMPLOYEE_INSTRUCT)
  async next(@ActiveCompany() companyId: string, @ActiveUser() user: Sender, @Query('host') host?: string, @Query('team') team?: string, @Query('wait') wait?: string) {
    const command = await this.claude.next(companyId, user.id, { host, team: team === '1' }, wait ? Number(wait) : undefined);
    return { command };
  }

  /** Runner: masih hidup (dikirim tiap ±20 dtk selama `claude -p` bekerja). */
  @Post('runner/ping')
  @HttpCode(200)
  @Permission(P_EMPLOYEE_INSTRUCT)
  ping(@ActiveCompany() companyId: string, @ActiveUser() user: Sender, @Body() body: { host?: string; team?: boolean; busy?: boolean }) {
    this.claude.heartbeat(companyId, user.id, body ?? {});
    return { ok: true };
  }

  @Post('runner/bye')
  @HttpCode(200)
  @Permission(P_EMPLOYEE_INSTRUCT)
  bye(@ActiveCompany() companyId: string, @ActiveUser() user: Sender) {
    return this.claude.bye(companyId, user.id);
  }

  /** Runner: hasil satu perintah (jawaban terakhir Claude). */
  @Post('commands/:id/result')
  @HttpCode(200)
  @Permission(P_EMPLOYEE_INSTRUCT)
  result(@ActiveCompany() companyId: string, @ActiveUser() user: Sender, @Param('id') id: string, @Body() body: { status?: string; reply?: string }) {
    return this.claude.complete(companyId, user.id, id, body ?? {});
  }
}
