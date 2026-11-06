import { Injectable, Logger, Optional } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { decryptSecret } from 'src/common/utils/secret-box';
import { API_KEY_PURPOSE } from '../ai-providers/provider-types';
import { ProviderAdapterRegistry } from './adapters/provider-adapter.registry';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ChatMessage } from './adapters/provider-adapter.interface';
import { ApprovalService } from '../approvals/approval.service';
import { WebhookNotificationService } from '../integrations/webhook-notification.service';

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly toolRegistry: ToolRegistryService,
    @Optional() private readonly approvalService?: ApprovalService,
    @Optional() private readonly webhooks?: WebhookNotificationService,
  ) {}

  /**
   * Menjalankan siklus otonom pemrosesan tugas oleh karyawan virtual.
   */
  async processTask(companyId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { employee: { include: { aiProvider: true } } },
    });

    if (!task) {
      this.logger.warn(`Task ${taskId} tidak ditemukan`);
      return;
    }

    const { employee } = task;

    // Jika employee tidak punya provider AI aktif, fallback ke simulasi cerdas
    if (!employee.aiProvider || !employee.aiProvider.isActive) {
      this.logger.log(`Task ${taskId} berjalan via simulated agent runtime (provider belum terhubung).`);
      await this.runSimulatedTask(companyId, task, employee);
      return;
    }

    const provider = employee.aiProvider;

    // 1. Inisialisasi: EXECUTING & WORKING
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'EXECUTING', startedAt: new Date() },
    });
    await this.prisma.taskEvent.create({
      data: { taskId, from: 'QUEUED', to: 'EXECUTING', note: 'AI Agent memulai pengerjaan tugas' },
    });
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { status: 'WORKING', currentTask: task.title, progress: 15 },
    });

    this.events.emit(companyId, 'task.event', { task: { ...task, status: 'EXECUTING', progress: 15 }, to: 'EXECUTING' });
    this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'WORKING', currentTask: task.title, progress: 15 });

    try {
      const apiKey = decryptSecret(provider.apiKeyEnc, API_KEY_PURPOSE) || '';
      const adapter = this.adapterRegistry.getAdapter(provider.type);

      const systemPrompt =
        `Anda adalah ${employee.name}, ${employee.role} di departemen ${employee.department}.\n` +
        `Keahlian: ${employee.skills.join(', ')}.\n` +
        `${employee.systemPrompt || ''}\n` +
        `Tugas Anda adalah menyelesaikan pekerjaan yang diberikan secara mandiri, akurat, dan profesional.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Tugas yang harus diselesaikan: "${task.title}".\n` +
            `Rincian: ${task.description || 'Selesaikan secara menyeluruh dan berikan ringkasan hasil kerja.'}`,
        },
      ];

      const tools = await this.toolRegistry.getDefinitionsForCompany(companyId);

      // Loop eksekusi (Maksimum 2 langkah)
      let step = 0;
      let isComplete = false;
      let finalSummary = '';

      while (step < 2 && !isComplete) {
        step++;

        // Status THINKING
        await this.prisma.employee.update({
          where: { id: employee.id },
          data: { status: 'THINKING', progress: 20 + step * 30 },
        });
        this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'THINKING', progress: 20 + step * 30 });

        const callStart = Date.now();
        const result = await adapter.complete(apiKey, provider.baseUrl, messages, {
          model: employee.model,
          temperature: 0.7,
          tools,
        });
        const durationMs = Date.now() - callStart;

        // Catat penggunaan token ke UsageRecord
        try {
          const promptTokens = result.usage?.promptTokens || 0;
          const completionTokens = result.usage?.completionTokens || 0;
          const totalTokens = result.usage?.totalTokens || (promptTokens + completionTokens);

          const m = (employee.model || '').toLowerCase();
          let promptRate = 0.0000025;
          let completionRate = 0.000010;
          if (m.includes('mini') || m.includes('flash') || m.includes('haiku')) {
            promptRate = 0.00000015; completionRate = 0.0000006;
          } else if (m.includes('deepseek')) {
            promptRate = 0.00000014; completionRate = 0.00000028;
          } else if (m.includes('claude-3-5') || m.includes('sonnet')) {
            promptRate = 0.000003; completionRate = 0.000015;
          }
          const estimatedCost = promptTokens * promptRate + completionTokens * completionRate;

          await this.prisma.usageRecord.create({
            data: {
              companyId,
              employeeId: employee.id,
              taskId: task.id,
              providerId: provider.id,
              model: employee.model,
              promptTokens,
              completionTokens,
              totalTokens,
              estimatedCost,
              durationMs,
            },
          });
        } catch (uErr: any) {
          this.logger.warn(`Gagal mencatat usage record untuk task ${taskId}: ${uErr.message}`);
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          const toolCall = result.toolCalls[0];

          // Evaluasi risiko tool (Human-in-the-loop)
          if (this.approvalService) {
            const assessment = this.approvalService.evaluateToolRisk(toolCall.name, toolCall.arguments);
            if (assessment.requiresApproval) {
              await this.approvalService.createRequest({
                companyId,
                taskId: task.id,
                employeeId: employee.id,
                toolName: toolCall.name,
                riskLevel: assessment.riskLevel,
                title: `Otorisasi Eksekusi: ${toolCall.name}`,
                description: assessment.reason,
                inputPayload: toolCall.arguments,
              });

              // Ubah status task ke WAITING
              await this.prisma.task.update({
                where: { id: task.id },
                data: { status: 'WAITING' },
              });
              await this.prisma.taskEvent.create({
                data: {
                  taskId: task.id,
                  from: 'EXECUTING',
                  to: 'WAITING',
                  note: `Menunggu otorisasi pimpinan untuk tool ${toolCall.name} (${assessment.riskLevel})`,
                },
              });
              await this.prisma.employee.update({
                where: { id: employee.id },
                data: { status: 'WAITING', currentTool: toolCall.name },
              });
              await this.prisma.employeeActivity.create({
                data: {
                  companyId,
                  employeeId: employee.id,
                  kind: 'warn',
                  text: `[WAITING] Membutuhkan otorisasi eksekusi [${toolCall.name}] (${assessment.riskLevel}).`,
                },
              });

              this.events.emit(companyId, 'task.event', { task: { ...task, status: 'WAITING' }, to: 'WAITING' });
              this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'WAITING', currentTool: toolCall.name });
              this.events.emit(companyId, 'activity.created', {
                employeeId: employee.id,
                kind: 'warn',
                text: `Menunggu otorisasi pimpinan untuk tool [${toolCall.name}].`,
              });

              // Hentikan eksekusi sementara sampai CEO/Pimpinan menyetujui
              return;
            }
          }

          // Status TOOL_EXECUTING
          await this.prisma.employee.update({
            where: { id: employee.id },
            data: { status: 'TOOL_EXECUTING', currentTool: toolCall.name },
          });
          this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'TOOL_EXECUTING', currentTool: toolCall.name });

          const output = await this.toolRegistry.execute(toolCall.name, toolCall.arguments, {
            companyId,
            employeeId: employee.id,
            taskId: task.id,
          });

          messages.push({
            role: 'assistant',
            content: result.content || '',
            toolCalls: result.toolCalls,
          });
          messages.push({
            role: 'tool',
            content: output,
            toolCallId: toolCall.id,
          });

          await this.prisma.employeeActivity.create({
            data: {
              companyId,
              employeeId: employee.id,
              kind: 'tool',
              text: `Tool [${toolCall.name}]: ${output.slice(0, 120)}`,
            },
          });
          this.events.emit(companyId, 'activity.created', {
            employeeId: employee.id,
            kind: 'tool',
            text: `Tool [${toolCall.name}] selesai dieksekusi.`,
          });
        } else {
          isComplete = true;
          finalSummary = result.content;
        }
      }

      // Finalisasi task: COMPLETED
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
        },
      });
      await this.prisma.taskEvent.create({
        data: { taskId, from: 'EXECUTING', to: 'COMPLETED', note: finalSummary.slice(0, 200) || 'Task diselesaikan dengan sukses' },
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 },
      });

      await this.prisma.employeeActivity.create({
        data: {
          companyId,
          employeeId: employee.id,
          kind: 'done',
          text: `Task "${task.title}" tuntas. ${finalSummary.slice(0, 100)}`,
        },
      });

      this.events.emit(companyId, 'task.event', { task: { ...task, status: 'COMPLETED' }, to: 'COMPLETED' });
      this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'IDLE', currentTask: null, currentTool: null, progress: 0 });
      this.events.emit(companyId, 'activity.created', { employeeId: employee.id, kind: 'done', text: `Task "${task.title}" selesai.` });

      if (this.webhooks) {
        this.webhooks.dispatch({
          companyId,
          event: 'task.completed',
          title: `Task Selesai: ${task.title}`,
          summary: `Karyawan [${employee.name}] telah menyelesaikan tugas "${task.title}".\nRingkasan: ${finalSummary.slice(0, 300)}`,
          data: { taskId: task.id, employeeId: employee.id },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error pemrosesan task ${taskId}: ${err.message}`, err.stack);
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 },
      });

      this.events.emit(companyId, 'task.event', { task: { ...task, status: 'FAILED' }, to: 'FAILED' });
      this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'IDLE' });

      if (this.webhooks) {
        this.webhooks.dispatch({
          companyId,
          event: 'task.failed',
          title: `Task Gagal: ${task.title}`,
          summary: `Karyawan [${employee.name}] gagal menyelesaikan tugas "${task.title}". Alasan: ${err.message}`,
          data: { taskId: task.id, employeeId: employee.id },
        });
      }
    }
  }

  /**
   * Fallback cerdas jika employee belum dihubungkan ke provider berbayar.
   */
  private async runSimulatedTask(companyId: string, task: any, employee: any): Promise<void> {
    const taskId = task.id;

    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'EXECUTING', startedAt: new Date() } });
    await this.prisma.employee.update({ where: { id: employee.id }, data: { status: 'WORKING', currentTask: task.title, progress: 25 } });
    this.events.emit(companyId, 'task.event', { task: { ...task, status: 'EXECUTING', progress: 25 }, to: 'EXECUTING' });
    this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'WORKING', currentTask: task.title, progress: 25 });

    // Step 1: Thinking (delay 1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    await this.prisma.employee.update({ where: { id: employee.id }, data: { status: 'THINKING', progress: 50 } });
    this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'THINKING', progress: 50 });

    // Step 2: Tool executing (delay 2s)
    await new Promise((r) => setTimeout(r, 2000));
    await this.prisma.employee.update({ where: { id: employee.id }, data: { status: 'TOOL_EXECUTING', currentTool: 'analisis_modul', progress: 75 } });
    this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'TOOL_EXECUTING', currentTool: 'analisis_modul', progress: 75 });
    await this.prisma.employeeActivity.create({
      data: { companyId, employeeId: employee.id, kind: 'tool', text: `Mengevaluasi komponen: ${task.title}` },
    });
    this.events.emit(companyId, 'activity.created', { employeeId: employee.id, kind: 'tool', text: `Mengevaluasi: ${task.title}` });

    // Step 3: Done (delay 1.5s)
    await new Promise((r) => setTimeout(r, 1500));
    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', finishedAt: new Date() } });
    await this.prisma.taskEvent.create({ data: { taskId, from: 'EXECUTING', to: 'COMPLETED', note: 'Task diselesaikan.' } });
    await this.prisma.employee.update({ where: { id: employee.id }, data: { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 } });

    await this.prisma.employeeActivity.create({
      data: { companyId, employeeId: employee.id, kind: 'done', text: `Tugas "${task.title}" tuntas diselesaikan.` },
    });

    this.events.emit(companyId, 'task.event', { task: { ...task, status: 'COMPLETED' }, to: 'COMPLETED' });
    this.events.emit(companyId, 'employee.updated', { id: employee.id, name: employee.name, status: 'IDLE', currentTask: null, currentTool: null, progress: 0 });
    this.events.emit(companyId, 'activity.created', { employeeId: employee.id, kind: 'done', text: `Tugas "${task.title}" selesai.` });
  }
}
