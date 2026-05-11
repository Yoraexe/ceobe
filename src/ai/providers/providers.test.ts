// Module: src/ai/providers/providers.test.ts
// Purpose: Unit tests for the Provider Router and adapters.
// Caller: vitest
// Dependencies: vitest, providers/router, providers/openAICompatibleAdapter, providers/types

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProviderAdapter } from './router';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter';
import { AnthropicAdapter } from './anthropicAdapter';
import { GeminiAdapter } from './geminiAdapter';

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
vi.mock('@google/genai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn()
    })
  }))
}));
vi.mock('../../config/env', () => {
  const actual = vi.importActual('../../config/env');
  return {
    ...actual,
    getGatewayUrl: vi.fn().mockReturnValue(''),
    env: {
      GEMINI_API_KEY: 'test-key',
      ANTHROPIC_API_KEY: 'test-key',
    }
  };
});

describe('Provider Router (createProviderAdapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars before each test
    const roles = ['PLANNER', 'EXECUTOR'];
    roles.forEach(role => {
      delete process.env[`CEOBE_${role}_PROVIDER`];
      delete process.env[`CEOBE_${role}_MODEL`];
      delete process.env[`CEOBE_${role}_BASE_URL`];
      delete process.env[`CEOBE_${role}_API_KEY`];
    });
    delete process.env.GLM_API_KEY;
    delete process.env.KIMI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should throw error if no provider is configured for Planner', () => {
    expect(() => createProviderAdapter('planner')).toThrow(/Provider untuk PLANNER belum dikonfigurasi/);
  });

  it('should throw error if no provider is configured for Executor', () => {
    expect(() => createProviderAdapter('executor')).toThrow(/Provider untuk EXECUTOR belum dikonfigurasi/);
  });

  it('should return a GeminiAdapter when explicitly set for Planner', () => {
    process.env.CEOBE_PLANNER_PROVIDER = 'gemini';
    const adapter = createProviderAdapter('planner');
    expect(adapter).toBeInstanceOf(GeminiAdapter);
    expect(adapter.name).toBe('gemini');
  });

  it('should return an AnthropicAdapter when explicitly set for Executor', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'claude';
    const adapter = createProviderAdapter('executor');
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
    expect(adapter.name).toBe('anthropic');
  });

  it('should return OpenAICompatibleAdapter for GLM when GLM_API_KEY is set', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'glm';
    process.env.GLM_API_KEY = 'test-glm-key';
    const adapter = createProviderAdapter('executor');
    expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    expect(adapter.name).toBe('glm');
    expect(adapter.modelId).toBe('glm-4-flash');
  });

  it('should allow model override via CEOBE_ROLE_MODEL', () => {
    process.env.CEOBE_PLANNER_PROVIDER = 'gemini';
    process.env.CEOBE_PLANNER_MODEL = 'gemini-exp';
    const adapter = createProviderAdapter('planner');
    expect(adapter.modelId).toBe('gemini-exp');
  });

  it('should throw if API key is missing for a known provider', () => {
    process.env.CEOBE_EXECUTOR_PROVIDER = 'groq';
    // GROQ_API_KEY NOT set
    expect(() => createProviderAdapter('executor')).toThrow(/GROQ_API_KEY/);
  });

  it('should return OpenAICompatibleAdapter for OpenAI even with custom role config', () => {
    process.env.CEOBE_PLANNER_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const adapter = createProviderAdapter('planner');
    expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    expect(adapter.name).toBe('openai');
  });
});
