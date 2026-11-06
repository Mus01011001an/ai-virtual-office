import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_DISCUSSION_READ, P_DISCUSSION_SEND, P_SUMMON_USE } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { DiscussionService } from './discussion.service';
import { WhiteboardService } from './whiteboard.service';
import {
  ConcludeMeetingDto,
  InitiateDebateDto,
  MessageDto,
  ParticipantsDto,
  StartDiscussionDto,
  UpdateWhiteboardDto,
} from './dto/discussion.dto';

@ApiTags('Office - Discussions')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_DISCUSSION_READ)
@Controller('office/discussions')
export class DiscussionController {
  constructor(
    private readonly service: DiscussionService,
    private readonly whiteboardService: WhiteboardService,
  ) {}

  @Post()
  @Permission(P_SUMMON_USE)
  start(@ActiveCompany() companyId: string, @Body() dto: StartDiscussionDto, @Session() s: UserSession) {
    return this.service.start(companyId, s.user.id, dto.participantIds);
  }

  @Patch(':id/participants')
  @Permission(P_SUMMON_USE)
  participants(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: ParticipantsDto) {
    return this.service.setParticipants(companyId, id, dto.participantIds);
  }

  @Post(':id/messages')
  @Permission(P_DISCUSSION_SEND)
  post(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: MessageDto, @Session() s: UserSession) {
    return this.service.post(companyId, id, s.user.id, dto.text);
  }

  @Get(':id/messages')
  messages(@ActiveCompany() companyId: string, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.messages(companyId, id, limit ? parseInt(limit, 10) : undefined);
  }

  @Post(':id/debate')
  @Permission(P_DISCUSSION_SEND)
  @ApiOperation({ summary: 'Memulai sesi debat otonom multi-agen berdasarkan topik tertentu' })
  initiateDebate(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
    @Body() dto: InitiateDebateDto,
    @Session() s: UserSession,
  ) {
    return this.service.initiateDebate(companyId, id, dto, s.user.id);
  }

  @Get(':id/whiteboard')
  @ApiOperation({ summary: 'Mendapatkan data kanvas papan tulis ruang rapat saat ini' })
  getWhiteboard(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.whiteboardService.getWhiteboard(companyId, id);
  }

  @Patch(':id/whiteboard')
  @Permission(P_DISCUSSION_SEND)
  @ApiOperation({ summary: 'Memperbarui data kanvas papan tulis ruang rapat' })
  updateWhiteboard(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWhiteboardDto,
  ) {
    return this.whiteboardService.updateWhiteboard(companyId, id, dto);
  }

  @Post(':id/conclude')
  @Permission(P_SUMMON_USE)
  @ApiOperation({ summary: 'Menutup rapat, menerbitkan MoM ke S3, dan membuat tugas otomatis' })
  conclude(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
    @Body() dto: ConcludeMeetingDto,
    @Session() s: UserSession,
  ) {
    return this.service.conclude(companyId, id, dto, s.user.id);
  }

  @Post(':id/end')
  @Permission(P_SUMMON_USE)
  end(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.end(companyId, id);
  }
}
