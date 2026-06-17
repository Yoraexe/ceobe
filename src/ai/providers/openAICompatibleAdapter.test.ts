import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatibleAdapter } from './openAICompatibleAdapter';
import { reloadEnv } from '../../config/env';
import { env } from '../../config/env';

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: { content: 'mock openai text' },
                finish_reason: 'stop'
              }
            ]
          })
        }
      }
    }))
  };
});

describe('OpenAICompatibleAdapter', () => {
  it('should generate text', async () => {
    process.env.OPENAI_API_KEY = 'test';
    reloadEnv();
    const adapter = new OpenAICompatibleAdapter('openai', 'gpt-4', 'key', 'http://base');
    const result = await adapter.generate('hello');
    expect((result as any).text).toBe('mock openai text');
  });

  it('should chat', async () => {
    process.env.OPENAI_API_KEY = 'test';
    reloadEnv();
    const adapter = new OpenAICompatibleAdapter('openai', 'gpt-4', 'key', 'http://base');
    const result = await adapter.chat([{ role: 'user', content: 'hello' }], [], 'sys');
    expect(result.content[0]).toEqual({ type: 'text', text: 'mock openai text' });
    expect(result.stop_reason).toBe('end_turn');
  });
});
