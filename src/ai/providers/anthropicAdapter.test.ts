import { describe, it, expect, vi } from 'vitest';
import { AnthropicAdapter } from './anthropicAdapter';
import { reloadEnv } from '../../config/env';
import { env } from '../../config/env';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'mock anthropic text' }],
          stop_reason: 'end_turn'
        })
      }
    }))
  };
});

describe('AnthropicAdapter', () => {
  it('should generate text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    reloadEnv();
    const adapter = new AnthropicAdapter();
    const result = await adapter.generate('hello');
    expect((result as any).text).toBe('mock anthropic text');
  });

  it('should chat', async () => {
    process.env.ANTHROPIC_API_KEY = 'test';
    reloadEnv();
    const adapter = new AnthropicAdapter();
    const result = await adapter.chat([{ role: 'user', content: 'hello' }], [], 'sys');
    expect(result.content[0]).toEqual({ type: 'text', text: 'mock anthropic text' });
    expect(result.stop_reason).toBe('end_turn');
  });
});
