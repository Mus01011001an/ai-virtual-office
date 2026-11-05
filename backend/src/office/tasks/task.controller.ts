import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_TASK_CANCEL, P_TASK_CREATE, P_TASK_READ } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/task.dto';

@ApiTags('Office - Tasks')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_TASK_READ)
@Controller('office')
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @Get('tasks')
  findAll(@ActiveCompany() companyId: string, @Query('status') status?: string, @Query('employeeId') employeeId?: string,
    @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(companyId, {
      status, employeeId, page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('employees/:employeeId/tasks')
  @Permission(P_TASK_CREATE)
  create(@ActiveCompany() companyId: string, @Param('employeeId') employeeId: string, @Body() dto: CreateTaskDto, @Session() s: UserSession) {
    return this.service.create(companyId, employeeId, dto, s.user.id);
  }

  @Post('tasks/:id/cancel')
  @Permission(P_TASK_CANCEL)
  cancel(@ActiveCompany() companyId: string, @Param('id') id: string, @Session() s: UserSession) {
    return this.service.cancel(companyId, id, s.user.id);
  }

  @Get('tasks/:id/events')
  events(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.events_(companyId, id);
  }
}
