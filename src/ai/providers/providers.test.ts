// Module: src/ai/providers/providers.test.ts
// Purpose: Unit tests for the Provider Router and adapters.
// Caller: vitest
// Dependencies: vitest, providers/router, providers/openAICompatibleAdapter, providers/types

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutorAdapter } from './router';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter';
import { AnthropicAdapter } from './anthropicAdapter';

// Mock external SDKs and internal deps to isolate the router logic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));
vi.mock('../gateway', () => ({
  getGatewayUrl: vi.fn().mockReturnValue(''),
}));

describe('Provider Router (createExecutorAdapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars before each test
    delete process.env.CEOBE_EXECUTOR_PROVIDER;
    delete process.env.CEOBE_EXECUTOR_MODEL;
    delete process.env.GLM_API_KEY;
    delete process.env.KIMI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  it('should return an AnthropicAdapter by default (no provider set)', () => {
    const adapter = createExecutorAdapter();
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(adapter.name).toBe('anthropic');
  });

  it('should return an AnthropicAdapter when provider=claude', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'claude';
    const adapter = createExecutorAdapter();
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it('should return OpenAICompatibleAdapter for GLM when GLM_API_KEY is set', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'glm';
    process.env.GLM_API_KEY = 'test-glm-key';
    const adapter = createExecutorAdapter();
    expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    expect(adapter.name).toBe('glm');
    expect(adapter.modelId).toBe('glm-4-flash');
  });

  it('should return OpenAICompatibleAdapter for Kimi when KIMI_API_KEY is set', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'kimi';
    process.env.KIMI_API_KEY = 'test-kimi-key';
    const adapter = createExecutorAdapter();
    expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    expect(adapter.name).toBe('kimi');
    expect(adapter.modelId).toBe('moonshot-v1-8k');
  });

  it('should allow model override via CEOBE_EXECUTOR_MODEL', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'glm';
    process.env.GLM_API_KEY = 'test-glm-key';
    process.env.CEOBE_EXECUTOR_MODEL = 'glm-4-plus';
    const adapter = createExecutorAdapter();
    expect(adapter.modelId).toBe('glm-4-plus');
  });

  it('should throw if API key is missing for a known provider', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'groq';
    // GROQ_API_KEY NOT set
    expect(() => createExecutorAdapter()).toThrow(/GROQ_API_KEY/);
  });

  it('should throw for an unknown provider without custom base URL set', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'unknown-llm';
    delete process.env.CEOBE_EXECUTOR_BASE_URL;
    delete process.env.CEOBE_EXECUTOR_API_KEY;
    expect(() => createExecutorAdapter()).toThrow(/Unknown provider/);
  });
});

describe('OpenAICompatibleAdapter message conversion', () => {
  it('should instantiate without throwing', () => {
    const adapter = new OpenAICompatibleAdapter('glm', 'glm-4-flash', 'key', 'https://test.api');
    expect(adapter.name).toBe('glm');
    expect(adapter.modelId).toBe('glm-4-flash');
  });
});
