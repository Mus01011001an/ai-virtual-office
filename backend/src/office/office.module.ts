import { Global, Module } from '@nestjs/common';
import { OfficeEventsService } from './realtime/office-events.service';
import { RealtimeController } from './realtime/realtime.controller';
import { AiProviderController } from './ai-providers/ai-provider.controller';
import { AiProviderService } from './ai-providers/ai-provider.service';
import { EmployeeController } from './employees/employee.controller';
import { EmployeeService } from './employees/employee.service';
import { TaskController } from './tasks/task.controller';
import { TaskService } from './tasks/task.service';
import { DiscussionController } from './discussions/discussion.controller';
import { DiscussionService } from './discussions/discussion.service';

/** Domain virtual office: AI provider, employee, task, diskusi, realtime SSE. */
@Global()
@Module({
  controllers: [RealtimeController, AiProviderController, EmployeeController, TaskController, DiscussionController],
  providers: [OfficeEventsService, AiProviderService, EmployeeService, TaskService, DiscussionService],
  exports: [OfficeEventsService, AiProviderService, EmployeeService],
})
export class OfficeModule {}
