import { Injectable, Logger } from '@nestjs/common';
import {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  IProviderAdapter,
} from './provider-adapter.interface';

@Injectable()
export class GeminiAdapter implements IProviderAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);

  async complete(
    apiKey: string,
    baseUrl: string,
    messages: ChatMessage[],
    options: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const root = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const model = options.model.replace(/^models\//, '');
    const url = `${root}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const payload: Record<string, unknown> = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Halo' }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1500,
      },
    };

    if (systemMsg) {
      payload.systemInstruction = {
        parts: [{ text: systemMsg }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Gemini error HTTP ${response.status}: ${errText}`);
      throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

    return {
      content: text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }
}
