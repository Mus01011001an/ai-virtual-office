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
import { BrainService } from '../brain/brain.service';
import { estimateCost } from './usage-cost';

/** Langkah maksimum per task (tiap langkah = 1 panggilan model + tool yang diminta). */
const MAX_STEPS = 6;

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
    @Optional() private readonly brain?: BrainService,
  ) {}

  private async setEmployee(companyId: string, id: string, name: string, data: Record<string, unknown>) {
    await this.prisma.employee.update({ where: { id }, data });
    this.events.emit(companyId, 'employee.updated', { id, name, ...data });
  }

  private async feed(companyId: string, employeeId: string, kind: string, text: string) {
    const row = await this.prisma.employeeActivity.create({ data: { companyId, employeeId, kind, text } });
    this.events.emit(companyId, 'activity.created', row);
  }

  /** System prompt = persona (template katalog bila ada) + otak kantor bersama + cara kerja. */
  async buildSystemPrompt(companyId: string, employee: {
    id: string; name: string; role: string; department: string; skills: string[]; systemPrompt: string;
    template?: { systemPrompt: string } | null;
  }) {
    const persona = employee.template?.systemPrompt?.trim() || employee.systemPrompt || '';
    const brainCtx = this.brain ? await this.brain.buildContext(companyId, employee.id) : '';
    return [
      `Kamu adalah ${employee.name}, ${employee.role}${employee.department ? ` di tim ${employee.department}` : ''} di kantor virtual ini.`,
      employee.skills.length ? `Keahlian: ${employee.skills.join(', ')}.` : '',
      persona,
      brainCtx,
      'Kerjakan tugas secara mandiri dan nyata: pakai tool yang tersedia, jangan mengarang hasil tool. ' +
        'Akhiri dengan ringkasan hasil kerja yang konkret (apa yang dibuat, link aset, langkah berikutnya).',
    ].filter(Boolean).join('\n\n');
  }

  async processTask(companyId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId },
      include: { employee: { include: { aiProvider: true, template: { select: { systemPrompt: true, tools: true } } } } },
    });
    if (!task) {
      this.logger.warn(`Task ${taskId} tidak ditemukan`);
      return;
    }
    const { employee } = task;
    const provider = employee.aiProvider;

    // Tanpa model: jangan berpura-pura selesai.
    if (!provider || !provider.isActive || provider.deletedAt) {
      await this.prisma.task.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
      await this.prisma.taskEvent.create({ data: { taskId, from: task.status, to: 'FAILED', note: 'AI belum terhubung ke model' } });
      await this.feed(companyId, employee.id, 'warn', `Belum bisa mengerjakan "${task.title}": AI ini belum terhubung ke model. Administrator perlu memasang AI provider di Katalog AI.`);
      this.events.emit(companyId, 'task.event', { task: { ...task, status: 'FAILED' }, to: 'FAILED' });
      return;
    }

    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'EXECUTING', startedAt: task.startedAt ?? new Date() } });
    await this.prisma.taskEvent.create({ data: { taskId, from: task.status, to: 'EXECUTING', note: 'AI mulai mengerjakan' } });
    this.events.emit(companyId, 'task.event', { task: { ...task, status: 'EXECUTING' }, to: 'EXECUTING' });
    await this.setEmployee(companyId, employee.id, employee.name, { status: 'WORKING', currentTask: task.title, progress: 10 });

    try {
      const apiKey = decryptSecret(provider.apiKeyEnc, API_KEY_PURPOSE) || '';
      const adapter = this.adapterRegistry.getAdapter(provider.type);
      const tools = await this.toolRegistry.getDefinitionsForCompany(companyId, employee.template?.tools);

      // Hasil tool yang sudah disetujui pimpinan (task dilanjutkan setelah approval).
      const approved = (await this.prisma.approvalRequest.findMany({
        where: { taskId, status: 'APPROVED' },
        select: { toolName: true, inputPayload: true, outputResult: true },
      })).filter((a) => a.outputResult != null);
      const approvedKeys = new Set(approved.map((a) => `${a.toolName}|${JSON.stringify(a.inputPayload)}`));

      const messages: ChatMessage[] = [
        { role: 'system', content: await this.buildSystemPrompt(companyId, employee) },
        {
          role: 'user',
          content: `Tugas: "${task.title}"\n${task.description ? `Rincian:\n${task.description}` : 'Selesaikan secara menyeluruh.'}` +
            (approved.length ? `\n\nHasil tool yang sudah disetujui pimpinan:\n${approved.map((a) => `- ${a.toolName}: ${JSON.stringify(a.outputResult).slice(0, 800)}`).join('\n')}` : ''),
        },
      ];

      let finalSummary = '';
      for (let step = 1; step <= MAX_STEPS; step++) {
        const progress = Math.min(90, 10 + step * 13);
        await this.setEmployee(companyId, employee.id, employee.name, { status: 'THINKING', progress, currentTool: null });

        const started = Date.now();
        const result = await adapter.complete(apiKey, provider.baseUrl, messages, {
          model: employee.model, temperature: 0.6, maxTokens: 2500, tools,
        });
        await this.recordUsage(companyId, employee.id, task.id, provider.id, employee.model, result.usage, Date.now() - started);

        const calls = result.toolCalls ?? [];
        if (!calls.length) {
          finalSummary = result.content || '';
          break;
        }

        messages.push({ role: 'assistant', content: result.content || '', toolCalls: calls });
        for (const call of calls) {
          const key = `${call.name}|${JSON.stringify(call.arguments)}`;
          if (this.approvalService && !approvedKeys.has(key)) {
            const risk = this.approvalService.evaluateToolRisk(call.name, call.arguments);
            if (risk.requiresApproval) {
              await this.waitForApproval(companyId, task, employee, call, risk);
              return;
            }
          }
          await this.setEmployee(companyId, employee.id, employee.name, { status: 'TOOL_EXECUTING', currentTool: call.name, progress });
          const output = await this.toolRegistry.execute(call.name, call.arguments, { companyId, employeeId: employee.id, taskId: task.id });
          messages.push({ role: 'tool', content: output.slice(0, 8000), toolCallId: call.id, name: call.name });
          await this.feed(companyId, employee.id, 'tool', `${call.name}: ${output.slice(0, 160)}`);
        }
        if (step === MAX_STEPS) {
          messages.push({ role: 'user', content: 'Batas langkah tercapai. Tulis ringkasan hasil kerja final sekarang tanpa memanggil tool.' });
          const last = await adapter.complete(apiKey, provider.baseUrl, messages, { model: employee.model, temperature: 0.4, maxTokens: 1500 });
          await this.recordUsage(companyId, employee.id, task.id, provider.id, employee.model, last.usage, 0);
          finalSummary = last.content || '';
        }
      }

      await this.prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', finishedAt: new Date() } });
      await this.prisma.taskEvent.create({ data: { taskId, from: 'EXECUTING', to: 'COMPLETED', note: finalSummary.slice(0, 200) || 'Selesai' } });
      await this.setEmployee(companyId, employee.id, employee.name, { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 });
      if (finalSummary) await this.feed(companyId, employee.id, 'output', finalSummary.slice(0, 4000));
      await this.feed(companyId, employee.id, 'done', `Selesai: ${task.title}`);
      this.events.emit(companyId, 'task.event', { task: { ...task, status: 'COMPLETED' }, to: 'COMPLETED' });

      // Hasil masuk otak kantor → rekan lain langsung tahu.
      await this.brain?.recordSafe({
        companyId, employeeId: employee.id, kind: 'result',
        title: task.title, content: finalSummary || '(tanpa ringkasan)',
      });

      this.webhooks?.dispatch({
        companyId, event: 'task.completed', title: `Task selesai: ${task.title}`,
        summary: `${employee.name} menyelesaikan "${task.title}".\n${finalSummary.slice(0, 300)}`,
        data: { taskId: task.id, employeeId: employee.id },
      });
    } catch (err: any) {
      this.logger.error(`Task ${taskId} gagal: ${err.message}`, err.stack);
      await this.prisma.task.update({ where: { id: taskId }, data: { status: 'FAILED', finishedAt: new Date() } });
      await this.prisma.taskEvent.create({ data: { taskId, from: 'EXECUTING', to: 'FAILED', note: String(err.message).slice(0, 200) } });
      await this.setEmployee(companyId, employee.id, employee.name, { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 });
      await this.feed(companyId, employee.id, 'error', `Gagal: ${task.title} — ${String(err.message).slice(0, 200)}`);
      this.events.emit(companyId, 'task.event', { task: { ...task, status: 'FAILED' }, to: 'FAILED' });
      this.webhooks?.dispatch({
        companyId, event: 'task.failed', title: `Task gagal: ${task.title}`,
        summary: `${employee.name} gagal mengerjakan "${task.title}". Alasan: ${err.message}`,
        data: { taskId: task.id, employeeId: employee.id },
      });
    }
  }

  private async waitForApproval(
    companyId: string,
    task: { id: string; title: string },
    employee: { id: string; name: string },
    call: { name: string; arguments: Record<string, unknown> },
    risk: { riskLevel: any; reason: string },
  ) {
    await this.approvalService!.createRequest({
      companyId, taskId: task.id, employeeId: employee.id, toolName: call.name, riskLevel: risk.riskLevel,
      title: `Otorisasi: ${call.name}`, description: risk.reason, inputPayload: call.arguments,
    });
    await this.prisma.task.update({ where: { id: task.id }, data: { status: 'WAITING' } });
    await this.prisma.taskEvent.create({ data: { taskId: task.id, from: 'EXECUTING', to: 'WAITING', note: `Menunggu otorisasi ${call.name} (${risk.riskLevel})` } });
    await this.setEmployee(companyId, employee.id, employee.name, { status: 'WAITING', currentTool: call.name });
    await this.feed(companyId, employee.id, 'warn', `Menunggu otorisasi pimpinan untuk ${call.name} (${risk.riskLevel}).`);
    this.events.emit(companyId, 'task.event', { task: { ...task, status: 'WAITING' }, to: 'WAITING' });
  }

  private async recordUsage(
    companyId: string, employeeId: string, taskId: string, providerId: string, model: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined, durationMs: number,
  ) {
    try {
      const promptTokens = usage?.promptTokens || 0;
      const completionTokens = usage?.completionTokens || 0;
      await this.prisma.usageRecord.create({
        data: {
          companyId, employeeId, taskId, providerId, model, promptTokens, completionTokens,
          totalTokens: usage?.totalTokens || promptTokens + completionTokens,
          estimatedCost: estimateCost(model, promptTokens, completionTokens), durationMs,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Gagal mencatat usage task ${taskId}: ${e.message}`);
    }
  }
}
