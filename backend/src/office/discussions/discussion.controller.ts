import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_DISCUSSION_READ, P_DISCUSSION_SEND, P_SUMMON_USE } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { DiscussionService } from './discussion.service';
import { MessageDto, ParticipantsDto, StartDiscussionDto } from './dto/discussion.dto';

@ApiTags('Office - Discussions')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_DISCUSSION_READ)
@Controller('office/discussions')
export class DiscussionController {
  constructor(private readonly service: DiscussionService) {}

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

  @Post(':id/end')
  @Permission(P_SUMMON_USE)
  end(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.end(companyId, id);
  }
}
