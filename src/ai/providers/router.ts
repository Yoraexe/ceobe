// Module: src/ai/providers/router.ts
// Purpose: The Provider Router - reads CEOBE_EXECUTOR env vars and returns
//          the correct IProviderAdapter instance. This is the ONLY place where
//          provider selection logic lives. executor.ts stays completely clean.
// Caller: src/ai/executor.ts
// Dependencies: AnthropicAdapter, OpenAICompatibleAdapter, env, types
// Side Effects: none

import { env } from '../../config/env';
import { AnthropicAdapter } from './anthropicAdapter';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter';
import type { IProviderAdapter } from './types';
import chalk from 'chalk';

/**
 * Known provider configurations.
 * Maps a provider slug to its base URL.
 * The user only needs to set the API key in their .env.
 */
const KNOWN_PROVIDERS: Record<string, { baseURL: string; defaultModel: string }> = {
  // Anthropic (handled separately via native SDK, not here)
  claude: { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-5' },

  // Zhipu AI - GLM
  glm: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },

  // Moonshot AI - Kimi
  kimi: { baseURL: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },

  // DeepSeek
  deepseek: { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },

  // Alibaba Cloud - Qwen
  qwen: { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },

  // Groq (ultra-fast inference for open models like Llama, Gemma, Mixtral)
  groq: { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },

  // Together AI (hundreds of open models)
  together: { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },

  // Ollama (local LLMs, completely free)
  ollama: { baseURL: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },

  // OpenAI
  openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
};

/**
 * Creates and returns the appropriate provider adapter based on environment variables.
 *
 * To switch providers, configure in your .env:
 *   CEOBE_EXECUTOR_PROVIDER=glm
 *   CEOBE_EXECUTOR_MODEL=glm-4-plus          (optional, overrides default)
 *   GLM_API_KEY=your_key_here
 *
 * Defaults to 'claude' (Anthropic) if not set.
 */
export function createExecutorAdapter(): IProviderAdapter {
  const provider = (process.env.CEOBE_EXECUTOR_PROVIDER || 'claude').toLowerCase();
  const modelOverride = process.env.CEOBE_EXECUTOR_MODEL;

  if (provider === 'claude') {
    const modelId = modelOverride || 'claude-sonnet-4-5';
    console.log(chalk.dim(`[Provider Router] Using Anthropic Claude → ${modelId}`));
    return new AnthropicAdapter(modelId);
  }

  const known = KNOWN_PROVIDERS[provider];
  if (!known) {
    // Allow fully custom providers with explicit env vars
    const customBaseURL = process.env.CEOBE_EXECUTOR_BASE_URL;
    const customKey = process.env.CEOBE_EXECUTOR_API_KEY;
    const customModel = modelOverride || 'custom-model';

    if (!customBaseURL || !customKey) {
      throw new Error(
        `[Provider Router] Unknown provider '${provider}'. ` +
        `Set CEOBE_EXECUTOR_BASE_URL and CEOBE_EXECUTOR_API_KEY for custom providers, ` +
        `or use one of: ${Object.keys(KNOWN_PROVIDERS).join(', ')}`
      );
    }

    console.log(chalk.dim(`[Provider Router] Using custom provider '${provider}' → ${customModel}`));
    return new OpenAICompatibleAdapter(provider, customModel, customKey, customBaseURL);
  }

  const modelId = modelOverride || known.defaultModel;
  // Resolve API key: convention is {PROVIDER_UPPERCASE}_API_KEY
  const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[apiKeyEnvVar] || '';

  if (!apiKey) {
    throw new Error(
      `[Provider Router] API key not found for provider '${provider}'. ` +
      `Please set ${apiKeyEnvVar} in your .env file.`
    );
  }

  console.log(chalk.dim(`[Provider Router] Using ${provider.toUpperCase()} → ${modelId}`));
  return new OpenAICompatibleAdapter(provider, modelId, apiKey, known.baseURL);
}
