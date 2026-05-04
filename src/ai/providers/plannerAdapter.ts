// Module: src/ai/providers/plannerAdapter.ts
// Purpose: Universal text-generation adapter for Ceobe's Planner.
//          The Planner only needs simple "send prompt → get text" — no tool calling.
//          Supports Gemini natively, and any OpenAI-compatible provider (GLM, Kimi, etc.)
// Caller: src/ai/planner.ts
// Dependencies: @google/genai, openai, env, gateway
// Side Effects: HTTP requests to AI providers

import chalk from 'chalk';

export interface IPlannerAdapter {
  readonly name: string;
  readonly modelId: string;
  generate(prompt: string, temperature?: number): Promise<string>;
}

// ─── Gemini (Google GenAI) ────────────────────────────────────────────────────

class GeminiPlannerAdapter implements IPlannerAdapter {
  readonly name = 'gemini';
  readonly modelId: string;
  private client: any; // GoogleGenAI — imported lazily to avoid crashing when not used

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const { getGeminiClient } = await import('../geminiClient');
      this.client = getGeminiClient();
    }
    return this.client;
  }

  async generate(prompt: string, temperature: number = 0.2): Promise<string> {
    const { withRetry } = await import('../../utils/retry');
    const client = await this.getClient();
    const response: any = await withRetry(() =>
      client.models.generateContent({
        model: this.modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature },
      })
    );
    return (response.text || '').trim();
  }
}

// ─── OpenAI-compatible (GLM, Kimi, DeepSeek, Groq, Claude, GPT-4, Ollama…) ──

class OpenAICompatiblePlannerAdapter implements IPlannerAdapter {
  readonly name: string;
  readonly modelId: string;
  private client: any; // OpenAI instance

  constructor(name: string, modelId: string, apiKey: string, baseURL: string) {
    this.name = name;
    this.modelId = modelId;
    // Lazy import handled in generate()
    this._apiKey = apiKey;
    this._baseURL = baseURL;
  }

  private _apiKey: string;
  private _baseURL: string;

  private async getClient(): Promise<any> {
    if (!this.client) {
      const OpenAI = (await import('openai')).default;
      this.client = new OpenAI({ apiKey: this._apiKey, baseURL: this._baseURL });
    }
    return this.client;
  }

  async generate(prompt: string, temperature: number = 0.2): Promise<string> {
    const { withRetry } = await import('../../utils/retry');
    const client = await this.getClient();
    const response: any = await withRetry(() =>
      client.chat.completions.create({
        model: this.modelId,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      })
    );
    return (response.choices[0]?.message?.content || '').trim();
  }
}

// ─── Anthropic (Claude) via native SDK ───────────────────────────────────────

class AnthropicPlannerAdapter implements IPlannerAdapter {
  readonly name = 'anthropic';
  readonly modelId: string;
  private client: any;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const { env } = await import('../../config/env');
      const { getGatewayUrl } = await import('../gateway');
      const gatewayUrl = getGatewayUrl('anthropic');
      this.client = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        ...(gatewayUrl ? { baseURL: gatewayUrl } : {}),
      });
    }
    return this.client;
  }

  async generate(prompt: string, temperature: number = 0.2): Promise<string> {
    const { withRetry } = await import('../../utils/retry');
    const client = await this.getClient();
    const response: any = await withRetry(() =>
      client.messages.create({
        model: this.modelId,
        max_tokens: 8192,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      })
    );
    const block = response.content.find((c: any) => c.type === 'text');
    return (block?.text || '').trim();
  }
}

// ─── Provider Registry (mirrors executor router) ─────────────────────────────

const PLANNER_KNOWN_PROVIDERS: Record<string, { baseURL: string; defaultModel: string }> = {
  glm:      { baseURL: 'https://open.bigmodel.cn/api/paas/v4',               defaultModel: 'glm-4-plus'              },
  kimi:     { baseURL: 'https://api.moonshot.cn/v1',                          defaultModel: 'moonshot-v1-32k'         },
  deepseek: { baseURL: 'https://api.deepseek.com/v1',                         defaultModel: 'deepseek-chat'           },
  qwen:     { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',   defaultModel: 'qwen-max'                },
  groq:     { baseURL: 'https://api.groq.com/openai/v1',                      defaultModel: 'llama-3.3-70b-versatile' },
  together: { baseURL: 'https://api.together.xyz/v1',                         defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' },
  ollama:   { baseURL: 'http://localhost:11434/v1',                            defaultModel: 'llama3.2'                },
  openai:   { baseURL: 'https://api.openai.com/v1',                           defaultModel: 'gpt-4o'                  },
};

/**
 * Creates and returns the appropriate planner adapter.
 *
 * Configure in .env or via `ceobe key set`:
 *   CEOBE_PLANNER_PROVIDER=glm
 *   CEOBE_PLANNER_MODEL=glm-4-plus      (optional)
 *   GLM_API_KEY=your_key_here
 *
 * Defaults to Gemini if not set.
 */
export function createPlannerAdapter(): IPlannerAdapter {
  const provider = (process.env.CEOBE_PLANNER_PROVIDER || 'gemini').toLowerCase();
  const modelOverride = process.env.CEOBE_PLANNER_MODEL;

  if (provider === 'gemini') {
    const modelId = modelOverride || 'gemini-2.5-pro-preview-05-06';
    console.log(chalk.dim(`[Planner Router] Using Gemini → ${modelId}`));
    return new GeminiPlannerAdapter(modelId);
  }

  if (provider === 'claude' || provider === 'anthropic') {
    const modelId = modelOverride || 'claude-sonnet-4-5';
    console.log(chalk.dim(`[Planner Router] Using Anthropic Claude → ${modelId}`));
    return new AnthropicPlannerAdapter(modelId);
  }

  const known = PLANNER_KNOWN_PROVIDERS[provider];
  if (!known) {
    const customBaseURL = process.env.CEOBE_PLANNER_BASE_URL;
    const customKey = process.env.CEOBE_PLANNER_API_KEY || process.env[`${provider.toUpperCase()}_API_KEY`] || '';
    const customModel = modelOverride || 'custom-model';
    if (!customBaseURL || !customKey) {
      throw new Error(
        `[Planner Router] Unknown provider '${provider}'. ` +
        `Set CEOBE_PLANNER_BASE_URL and CEOBE_PLANNER_API_KEY, ` +
        `or use: gemini, claude, ${Object.keys(PLANNER_KNOWN_PROVIDERS).join(', ')}`
      );
    }
    console.log(chalk.dim(`[Planner Router] Using custom provider '${provider}' → ${customModel}`));
    return new OpenAICompatiblePlannerAdapter(provider, customModel, customKey, customBaseURL);
  }

  const modelId = modelOverride || known.defaultModel;
  const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[apiKeyEnvVar] || '';
  if (!apiKey) {
    throw new Error(
      `[Planner Router] API key missing for '${provider}'. Please set ${apiKeyEnvVar}.`
    );
  }

  console.log(chalk.dim(`[Planner Router] Using ${provider.toUpperCase()} → ${modelId}`));
  return new OpenAICompatiblePlannerAdapter(provider, modelId, apiKey, known.baseURL);
}
