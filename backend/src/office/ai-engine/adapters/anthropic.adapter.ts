import { Injectable, Logger } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  IProviderAdapter,
} from './provider-adapter.interface';

@Injectable()
export class AnthropicAdapter implements IProviderAdapter {
  private readonly logger = new Logger(AnthropicAdapter.name);

  async complete(
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const root = (baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const url = `${root}/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    // Ekstrak system prompt jika ada
    const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const formattedMessages = nonSystemMessages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
            },
          ],
        };
      }
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      };
    });

    const payload: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      system: systemMsg,
      messages: formattedMessages.length > 0 ? formattedMessages : [{ role: 'user', content: 'Halo' }],
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Anthropic error HTTP ${response.status}: ${errText}`);
      throw new Error(`Anthropic API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    let textContent = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input ?? {},
          });
        }
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
    };
  }
}
