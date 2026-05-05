// Module: src/ai/providers/embeddingAdapter.ts
// Purpose: Universal embedding adapter for Ceobe's RAG memory (Indexer).
// Caller: src/ai/memory/indexer.ts
// Dependencies: @google/genai, openai, env, utils/retry
// Side Effects: HTTP requests to AI providers

import chalk from 'chalk';
import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';
import { withRetry } from '../../utils/retry';

export interface IEmbeddingAdapter {
  readonly name: string;
  readonly modelId: string;
  getEmbedding(text: string): Promise<number[]>;
}

// ─── Gemini (Google GenAI) ────────────────────────────────────────────────────

class GeminiEmbeddingAdapter implements IEmbeddingAdapter {
  readonly name = 'gemini';
  readonly modelId: string;
  private client: any;

  constructor(modelId: string = 'text-embedding-004') {
    this.modelId = modelId;
  }

  private getClient(): any {
    if (!this.client) {
      const genAI = new (GoogleGenAI as any)({ apiKey: env.GEMINI_API_KEY, apiVersion: 'v1' });
      this.client = (genAI as any).models;
    }
    return this.client;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const client = this.getClient();
    const response: any = await withRetry(() =>
      client.embedContent({
        model: this.modelId,
        content: { parts: [{ text }] },
      })
    );
    return response.embedding?.values || [];
  }
}

// ─── OpenAI-compatible (OpenAI, GLM, Ollama) ────────────────────────────────

class OpenAICompatibleEmbeddingAdapter implements IEmbeddingAdapter {
  readonly name: string;
  readonly modelId: string;
  private client: any;
  private _apiKey: string;
  private _baseURL: string;

  constructor(name: string, modelId: string, apiKey: string, baseURL: string) {
    this.name = name;
    this.modelId = modelId;
    this._apiKey = apiKey;
    this._baseURL = baseURL;
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      const OpenAI = (await import('openai')).default;
      this.client = new OpenAI({ apiKey: this._apiKey, baseURL: this._baseURL });
    }
    return this.client;
  }

  async getEmbedding(text: string): Promise<number[]> {
    const { withRetry } = await import('../../utils/retry');
    const client = await this.getClient();
    const response: any = await withRetry(() =>
      client.embeddings.create({
        model: this.modelId,
        input: text,
      })
    );
    return response.data[0]?.embedding || [];
  }
}

// ─── Provider Registry ───────────────────────────────────────────────────────

const EMBEDDING_KNOWN_PROVIDERS: Record<string, { baseURL: string; defaultModel: string }> = {
  glm:      { baseURL: 'https://open.bigmodel.cn/api/paas/v4',               defaultModel: 'embedding-2'             },
  openai:   { baseURL: 'https://api.openai.com/v1',                           defaultModel: 'text-embedding-3-small'  },
  ollama:   { baseURL: 'http://localhost:11434/v1',                            defaultModel: 'nomic-embed-text'        },
  together: { baseURL: 'https://api.together.xyz/v1',                         defaultModel: 'togethercomputer/m2-bert-80M-8k-retrieval' },
  // Note: Claude, Kimi, DeepSeek, Groq, and Qwen do not have standard public embedding endpoints 
  // or use non-standard routes. We will fallback to Gemini or OpenAI if configured.
};

/**
 * Creates and returns the appropriate embedding adapter.
 *
 * It checks CEOBE_EMBEDDING_PROVIDER first.
 * If not set, it checks CEOBE_PLANNER_PROVIDER to see if it supports embeddings.
 * Defaults to 'gemini' if no compatible provider is found.
 */
export function createEmbeddingAdapter(): IEmbeddingAdapter {
  let provider = (process.env.CEOBE_EMBEDDING_PROVIDER || '').toLowerCase();
  const modelOverride = process.env.CEOBE_EMBEDDING_MODEL;

  // Fallback to Planner provider if no explicit embedding provider is set
  if (!provider) {
    const plannerProv = (process.env.CEOBE_PLANNER_PROVIDER || 'gemini').toLowerCase();
    if (plannerProv === 'gemini' || EMBEDDING_KNOWN_PROVIDERS[plannerProv]) {
      provider = plannerProv;
    } else {
      provider = 'gemini'; // Ultimate fallback
    }
  }

  // Dimension mismatch safety: if provider changes, we should warn the user
  // However, for simplicity here, we just return the adapter. 
  // The Indexer should handle dimension clearing if needed.

  if (provider === 'gemini') {
    const modelId = modelOverride || 'text-embedding-004';
    return new GeminiEmbeddingAdapter(modelId);
  }

  const known = EMBEDDING_KNOWN_PROVIDERS[provider];
  if (!known) {
    const customBaseURL = process.env.CEOBE_EMBEDDING_BASE_URL;
    const customKey = process.env.CEOBE_EMBEDDING_API_KEY || process.env[`${provider.toUpperCase()}_API_KEY`] || '';
    const customModel = modelOverride || 'custom-embedding-model';
    if (!customBaseURL || !customKey) {
      throw new Error(
        `[Embedding Router] Provider '${provider}' does not support embeddings out-of-the-box, or is missing BASE_URL.`
      );
    }
    return new OpenAICompatibleEmbeddingAdapter(provider, customModel, customKey, customBaseURL);
  }

  const modelId = modelOverride || known.defaultModel;
  const apiKeyEnvVar = `${provider.toUpperCase()}_API_KEY`;
  const apiKey = process.env[apiKeyEnvVar] || '';
  if (!apiKey && provider !== 'ollama') {
    throw new Error(
      `[Embedding Router] API key missing for '${provider}'. Please set ${apiKeyEnvVar}.`
    );
  }

  return new OpenAICompatibleEmbeddingAdapter(provider, modelId, apiKey, known.baseURL);
}
