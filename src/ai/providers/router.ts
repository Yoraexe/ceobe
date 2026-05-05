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
import { GeminiAdapter } from './geminiAdapter';
import type { IProviderAdapter } from './types';
import chalk from 'chalk';

/**
 * Known provider configurations.
 * Maps a provider slug to its base URL.
 */
const KNOWN_PROVIDERS: Record<string, { baseURL: string; defaultModel: string }> = {
  claude:   { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-5' },
  gemini:   { baseURL: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-1.5-flash' },
  glm:      { baseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  kimi:     { baseURL: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  qwen:     { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  groq:     { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  together: { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  ollama:   { baseURL: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
  openai:   { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
};

/**
 * Creates and returns the appropriate provider adapter.
 * Supports both 'planner' and 'executor' roles.
 */
export function createProviderAdapter(role: 'planner' | 'executor' = 'executor'): IProviderAdapter {
  const roleUpper = role.toUpperCase();
  const provider = (process.env[`CEOBE_${roleUpper}_PROVIDER`] || (role === 'planner' ? 'gemini' : 'claude')).toLowerCase();
  const modelOverride = process.env[`CEOBE_${roleUpper}_MODEL`];

  if (provider === 'gemini') {
    const modelId = modelOverride || KNOWN_PROVIDERS.gemini.defaultModel;
    console.log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using Gemini → ${modelId}`));
    return new GeminiAdapter(modelId);
  }

  if (provider === 'claude' || provider === 'anthropic') {
    const modelId = modelOverride || KNOWN_PROVIDERS.claude.defaultModel;
    console.log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using Anthropic Claude → ${modelId}`));
    return new AnthropicAdapter(modelId);
  }

  const known = KNOWN_PROVIDERS[provider];
  if (!known) {
    // Allow fully custom providers with explicit env vars
    const customBaseURL = process.env[`CEOBE_${roleUpper}_BASE_URL`];
    const customKey = process.env[`CEOBE_${roleUpper}_API_KEY`];
    const customModel = modelOverride || 'custom-model';

    if (!customBaseURL || !customKey) {
      throw new Error(
        `[Provider Router] Unknown provider '${provider}' for role '${role}'. ` +
        `Set CEOBE_${roleUpper}_BASE_URL and CEOBE_${roleUpper}_API_KEY for custom providers, ` +
        `or use: ${Object.keys(KNOWN_PROVIDERS).join(', ')}`
      );
    }

    console.log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using custom provider '${provider}' → ${customModel}`));
    return new OpenAICompatibleAdapter(provider, customModel, customKey, customBaseURL);
  }

  const modelId = modelOverride || known.defaultModel;
  const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[apiKeyEnvVar] || (provider === 'openai' ? process.env.OPENAI_API_KEY : '');

  if (!apiKey) {
    throw new Error(
      `[Provider Router] API key not found for provider '${provider}' in role '${role}'. ` +
      `Please set ${apiKeyEnvVar} in your environment.`
    );
  }

  console.log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using ${provider.toUpperCase()} → ${modelId}`));
  return new OpenAICompatibleAdapter(provider, modelId, apiKey, known.baseURL);
}

/** Legacy alias for compatibility */
export const createExecutorAdapter = () => createProviderAdapter('executor');
