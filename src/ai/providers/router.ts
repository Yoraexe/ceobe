// Tujuan: Mengidentifikasi provider dari environment dan mengembalikan adapter IProviderAdapter yang sesuai.
// Caller: src/ai/planner.ts, src/ai/executor.ts
// Dependensi: AnthropicAdapter, OpenAICompatibleAdapter, GeminiAdapter, env, types, chalk
// Main Functions: createProviderAdapter, createExecutorAdapter
// Side Effects: Tidak ada.
// v1.0.0: Router Provider untuk Multi-Tenant AI.

import { log } from '../../utils/context';

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
  claude:   { baseURL: 'https://api.anthropic.com/v1', defaultModel: 'claude-4-5-sonnet' },
  gemini:   { baseURL: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.5-flash' },
  glm:      { baseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-5.1-flash' },
  kimi:     { baseURL: 'https://api.moonshot.cn/v1', defaultModel: 'kimi-k2.6-plus' },
  deepseek: { baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-v3' },
  qwen:     { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-3-max' },
  groq:     { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  together: { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  ollama:   { baseURL: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
  openai:   { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
};

/**
 * Creates and returns the appropriate provider adapter.
 * Supports 'planner', 'executor', and 'qa' roles.
 *
 * QA Role Resolution:
 *   1. Try CEOBE_QA_PROVIDER / CEOBE_QA_MODEL.
 *   2. If not set, fall back to CEOBE_PLANNER_PROVIDER / CEOBE_PLANNER_MODEL.
 * This ensures the QA auditor is always a DIFFERENT "eye" than the Executor.
 */
export function createProviderAdapter(role: 'planner' | 'executor' | 'qa' = 'executor'): IProviderAdapter {
  const roleUpper = role.toUpperCase();

  let provider: string;
  let modelOverride: string | undefined;

  let providerRole = roleUpper;

  if (role === 'qa') {
    // QA: Use dedicated QA provider first, fallback to Planner
    if (process.env['CEOBE_QA_PROVIDER']) {
      provider = process.env['CEOBE_QA_PROVIDER'].toLowerCase();
      modelOverride = process.env['CEOBE_QA_MODEL'];
      providerRole = 'QA';
      log(chalk.dim(`[Provider Router] Role: QA | Using dedicated QA provider`));
    } else {
      provider = (process.env['CEOBE_PLANNER_PROVIDER'] || '').toLowerCase();
      modelOverride = process.env['CEOBE_PLANNER_MODEL'];
      providerRole = 'PLANNER';
      log(chalk.dim(`[Provider Router] Role: QA | No CEOBE_QA_PROVIDER set — falling back to Planner provider`));
    }
  } else {
    const otherRole = role === 'planner' ? 'EXECUTOR' : 'PLANNER';
    // Try specific role first, then fallback to the other role's provider
    if (process.env[`CEOBE_${roleUpper}_PROVIDER`]) {
      provider = process.env[`CEOBE_${roleUpper}_PROVIDER`]!.toLowerCase();
      modelOverride = process.env[`CEOBE_${roleUpper}_MODEL`];
      providerRole = roleUpper;
    } else {
      provider = (process.env[`CEOBE_${otherRole}_PROVIDER`] || '').toLowerCase();
      modelOverride = process.env[`CEOBE_${otherRole}_MODEL`];
      providerRole = otherRole;
    }
  }

  if (!provider) {
    throw new Error(
      `Provider untuk ${roleUpper} belum dikonfigurasi.\n` +
      `Gunakan: ceobe key set ${role}-provider <name>\n` +
      `Contoh: ceobe key set planner-provider gemini`
    );
  }

  if (provider === 'gemini') {
    const modelId = modelOverride || KNOWN_PROVIDERS.gemini.defaultModel;
    log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using Gemini → ${modelId}`));
    return new GeminiAdapter(modelId);
  }

  if (provider === 'claude' || provider === 'anthropic') {
    const modelId = modelOverride || KNOWN_PROVIDERS.claude.defaultModel;
    log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using Anthropic Claude → ${modelId}`));
    return new AnthropicAdapter(modelId);
  }

  const known = KNOWN_PROVIDERS[provider];
  if (!known) {
    // Allow fully custom providers with explicit env vars
    const customBaseURL = process.env[`CEOBE_${providerRole}_BASE_URL`];
    const customKey = process.env[`CEOBE_${providerRole}_API_KEY`];
    const customModel = modelOverride || 'custom-model';

    if (!customBaseURL || !customKey) {
      throw new Error(
        `[Provider Router] Unknown provider '${provider}' for role '${role}'. ` +
        `Set CEOBE_${providerRole}_BASE_URL and CEOBE_${providerRole}_API_KEY for custom providers, ` +
        `or use: ${Object.keys(KNOWN_PROVIDERS).join(', ')}`
      );
    }

    log(chalk.dim(`[Provider Router] Role: ${roleUpper} (Config: ${providerRole}) | Using custom provider '${provider}' → ${customModel}`));
    return new OpenAICompatibleAdapter(provider, customModel, customKey, customBaseURL);
  }

  const modelId = modelOverride || known.defaultModel;
  const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[apiKeyEnvVar] || (provider === 'openai' ? process.env.OPENAI_API_KEY : '');

  if (!apiKey && provider !== 'ollama') {
    throw new Error(
      `[Provider Router] API key not found for provider '${provider}' in role '${role}'. ` +
      `Please set ${apiKeyEnvVar} in your environment.`
    );
  }

  log(chalk.dim(`[Provider Router] Role: ${roleUpper} | Using ${provider.toUpperCase()} → ${modelId}`));
  return new OpenAICompatibleAdapter(provider, modelId, apiKey || '', known.baseURL);
}

/** Legacy alias for compatibility */
export const createExecutorAdapter = () => createProviderAdapter('executor');
