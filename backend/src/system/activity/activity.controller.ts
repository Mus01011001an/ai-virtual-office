import { P_ACTIVITY_READ } from 'src/common/constants/permissions';
import { Permission } from 'src/lib/auth/permission.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@ApiTags('System - Activity Logs')
@Permission(P_ACTIVITY_READ)
@Controller('system/activity-logs')
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  findAll(
    @Session() session: UserSession,
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const companyId = (session.user as any).companyId;
    return this.service.findAll({
      subjectType,
      subjectId,
      companyId,
      page: page !== undefined ? parseInt(page, 10) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
      q,
    });
  }
}
