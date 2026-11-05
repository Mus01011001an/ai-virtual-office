/** Tipe AI provider yang didukung + base URL default. */
export const PROVIDER_TYPES = {
  openai_compatible: { label: 'OpenAI-compatible (9router, OpenRouter, Ollama, LM Studio…)', defaultBaseUrl: '', needsBaseUrl: true },
  openai: { label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', needsBaseUrl: false },
  anthropic: { label: 'Anthropic (Claude)', defaultBaseUrl: 'https://api.anthropic.com/v1', needsBaseUrl: false },
  google: { label: 'Google (Gemini)', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', needsBaseUrl: false },
  deepseek: { label: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', needsBaseUrl: false },
} as const;

export type ProviderType = keyof typeof PROVIDER_TYPES;
export const PROVIDER_TYPE_KEYS = Object.keys(PROVIDER_TYPES) as ProviderType[];
export const API_KEY_PURPOSE = 'ai-provider-api-key';
