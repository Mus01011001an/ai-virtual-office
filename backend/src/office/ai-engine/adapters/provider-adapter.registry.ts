import { Injectable, NotFoundException } from '@nestjs/common';
import { IProviderAdapter } from './provider-adapter.interface';
import { OpenAIAdapter } from './openai.adapter';
import { AnthropicAdapter } from './anthropic.adapter';
import { GeminiAdapter } from './gemini.adapter';

@Injectable()
export class ProviderAdapterRegistry {
  constructor(
    private readonly openAIAdapter: OpenAIAdapter,
    private readonly anthropicAdapter: AnthropicAdapter,
    private readonly geminiAdapter: GeminiAdapter,
  ) {}

  getAdapter(providerType: string): IProviderAdapter {
    switch (providerType) {
      case 'openai':
      case 'openai_compatible':
      case 'deepseek':
        return this.openAIAdapter;
      case 'anthropic':
        return this.anthropicAdapter;
      case 'google':
        return this.geminiAdapter;
      default:
        // Default ke OpenAI-compatible format
        return this.openAIAdapter;
    }
  }
}
