import { Injectable, Logger } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  IProviderAdapter,
} from './provider-adapter.interface';

@Injectable()
export class OpenAIAdapter implements IProviderAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name);

  async complete(
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const root = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${root}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const payload: Record<string, unknown> = {
      model: options.model,
      stream: false,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            content: m.content,
            tool_call_id: m.toolCallId,
          };
        }
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1500,
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
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
      this.logger.error(`OpenAI error HTTP ${response.status}: ${errText}`);
      throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      // Fallback parsing jika gateway/proxy mengembalikan raw SSE stream (data: {...})
      const lines = rawText.split('\n');
      let accumulatedContent = '';
      let lastData: any = null;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            lastData = parsed;
            const delta =
              parsed.choices?.[0]?.delta?.content ||
              parsed.choices?.[0]?.message?.content;
            if (delta) accumulatedContent += delta;
          } catch {}
        }
      }
      if (lastData) {
        data = {
          ...lastData,
          choices: [
            {
              message: {
                content:
                  accumulatedContent ||
                  lastData.choices?.[0]?.message?.content ||
                  '',
                tool_calls: lastData.choices?.[0]?.delta?.tool_calls || lastData.choices?.[0]?.message?.tool_calls,
              },
            },
          ],
        };
      } else {
        throw new Error(`Gagal membaca respons model AI: ${rawText.slice(0, 120)}`);
      }
    }
    const choice = data.choices?.[0];
    const message = choice?.message;

    let toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> | undefined;
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls = message.tool_calls.map((tc: any) => {
        let args: Record<string, unknown> = {};
        try {
          args = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments ?? {};
        } catch {
          args = {};
        }
        return {
          id: tc.id || `tc_${Date.now()}`,
          name: tc.function?.name || '',
          arguments: args,
        };
      });
    }

    return {
      content: message?.content || '',
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }
}
