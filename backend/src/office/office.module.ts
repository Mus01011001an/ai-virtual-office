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
import { DebateOrchestratorService } from './discussions/debate-orchestrator.service';
import { WhiteboardService } from './discussions/whiteboard.service';
import { ScheduleController } from './schedule/schedule.controller';
import { ScheduleService } from './schedule/schedule.service';
import { StandupService } from './schedule/standup.service';
import { ProactiveService } from './schedule/proactive.service';
import { PresenceController } from './presence/presence.controller';
import { PresenceService } from './presence/presence.service';
import { SandboxController } from './sandbox/sandbox.controller';
import { SecureRunnerService } from './sandbox/secure-runner.service';
import { ApprovalController } from './approvals/approval.controller';
import { ApprovalService } from './approvals/approval.service';
import { IntegrationsController } from './integrations/integrations.controller';
import { GithubService } from './integrations/github.service';
import { WebhookNotificationService } from './integrations/webhook-notification.service';
import { VoiceController } from './voice/voice.controller';
import { VoiceService } from './voice/voice.service';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { WorkstationModule } from './workstation/workstation.module';
import { S3Module } from 'src/s3/s3.module';
import { McpModule } from './mcp/mcp.module';

/** Domain virtual office: AI provider, AI engine, employee, task, diskusi, jadwal, presence, realtime SSE, sandbox, approvals, webhook integrations, voice engine. */
@Global()
@Module({
  imports: [AiEngineModule, WorkstationModule, S3Module, McpModule],
  controllers: [
    RealtimeController,
    AiProviderController,
    EmployeeController,
    TaskController,
    DiscussionController,
    ScheduleController,
    PresenceController,
    SandboxController,
    ApprovalController,
    IntegrationsController,
    VoiceController,
  ],
  providers: [
    OfficeEventsService,
    AiProviderService,
    EmployeeService,
    TaskService,
    DiscussionService,
    DebateOrchestratorService,
    WhiteboardService,
    ScheduleService,
    StandupService,
    ProactiveService,
    PresenceService,
    SecureRunnerService,
    ApprovalService,
    GithubService,
    WebhookNotificationService,
    VoiceService,
  ],
  exports: [
    OfficeEventsService,
    AiProviderService,
    EmployeeService,
    TaskService,
    DiscussionService,
    DebateOrchestratorService,
    WhiteboardService,
    ScheduleService,
    StandupService,
    ProactiveService,
    PresenceService,
    SecureRunnerService,
    ApprovalService,
    GithubService,
    WebhookNotificationService,
    VoiceService,
    AiEngineModule,
    WorkstationModule,
    McpModule,
  ],
})
export class OfficeModule {}
