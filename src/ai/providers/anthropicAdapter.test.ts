import { describe, it, expect, vi } from 'vitest';
import { AnthropicAdapter } from './anthropicAdapter';
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
    env.ANTHROPIC_API_KEY = 'test';
    const adapter = new AnthropicAdapter();
    const result = await adapter.generate('hello');
    expect(result).toBe('mock anthropic text');
  });

  it('should chat', async () => {
    env.ANTHROPIC_API_KEY = 'test';
    const adapter = new AnthropicAdapter();
    const result = await adapter.chat([{ role: 'user', content: 'hello' }], [], 'sys');
    expect(result.content[0]).toEqual({ type: 'text', text: 'mock anthropic text' });
    expect(result.stop_reason).toBe('end_turn');
  });
});
