import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { decryptSecret } from 'src/common/utils/secret-box';
import { API_KEY_PURPOSE } from '../ai-providers/provider-types';
import { ProviderAdapterRegistry } from './adapters/provider-adapter.registry';
import { ChatMessage } from './adapters/provider-adapter.interface';

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  contextHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: boolean;
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly adapterRegistry: ProviderAdapterRegistry,
  ) {}

  /**
   * Inferensi langsung untuk karyawan virtual tertentu.
   */
  async generateForEmployee(
    companyId: string,
    employeeId: string,
    prompt: string,
    options: GenerateOptions = {},
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      include: { aiProvider: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} tidak ditemukan`);
    }

    if (!employee.aiProvider || !employee.aiProvider.isActive) {
      throw new BadRequestException(
        `Employee "${employee.name}" belum memiliki AI Provider yang aktif. Silakan hubungkan provider di menu AI Providers.`,
      );
    }

    const provider = employee.aiProvider;
    const apiKey = decryptSecret(provider.apiKeyEnc, API_KEY_PURPOSE) || '';
    const adapter = this.adapterRegistry.getAdapter(provider.type);

    const systemPrompt =
      `Anda adalah ${employee.name}, ${employee.role} di departemen ${employee.department}.\n` +
      `Keahlian Anda: ${employee.skills.join(', ')}.\n` +
      `${employee.systemPrompt || ''}\n` +
      `Jawablah secara ringkas, profesional, to-the-point, dan solutif.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (options.contextHistory && options.contextHistory.length > 0) {
      for (const h of options.contextHistory) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    messages.push({ role: 'user', content: prompt.trim() });

    const started = Date.now();
    try {
      const result = await adapter.complete(apiKey, provider.baseUrl, messages, {
        model: employee.model,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1000,
      });

      const latencyMs = Date.now() - started;

      // Catat penggunaan token ke ledger UsageRecord
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
            employeeId,
            providerId: provider.id,
            model: employee.model,
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost,
            durationMs: latencyMs,
          },
        });
      } catch (logErr: any) {
        this.logger.warn(`Gagal mencatat usage record: ${logErr.message}`);
      }

      return {
        text: result.content,
        toolCalls: result.toolCalls,
        usage: result.usage,
        latencyMs,
      };
    } catch (err: any) {
      this.logger.error(`Gagal memanggil model ${employee.model} untuk ${employee.name}: ${err.message}`);
      throw new BadRequestException(`Gagal memanggil model AI (${employee.model}): ${err.message}`);
    }
  }
}
