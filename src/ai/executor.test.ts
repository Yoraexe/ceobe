import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePlan, trimMessages } from './executor';
import { handleToolCall } from './tools/systemTools';
import type { NormalizedMessage } from './providers/types';

// Mock the entire provider router so executor doesn't need real API keys
vi.mock('./providers/router', () => ({
  createExecutorAdapter: vi.fn(),
}));
vi.mock('./tools/systemTools', () => ({
  tools: [{ name: 'mock_tool', description: 'mock', input_schema: { type: 'object', properties: {}, required: [] } }],
  handleToolCall: vi.fn(),
  activeBackgroundProcesses: new Map()
}));
vi.mock('ora', () => ({
  default: () => ({ start: vi.fn().mockReturnThis(), text: '', succeed: vi.fn(), fail: vi.fn() }),
}));
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    dim: vi.fn((s: string) => s),
  },
}));

import { createExecutorAdapter } from './providers/router';

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executePlan should execute plan and stop when no tools are called', async () => {
    const chatMock = vi.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'f1', name: 'finish_task', input: {} }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 10 }
    });

    (createExecutorAdapter as any).mockReturnValue({
      name: 'test',
      modelId: 'test-model',
      chat: chatMock,
    });

    await executePlan('Test plan');

    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it('executePlan should loop and execute tools if requested by the model', async () => {
    const chatMock = vi.fn()
      .mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'I need to run a tool' },
          { type: 'tool_use', id: 'tool1', name: 'read_file', input: { file_path: 'test.ts' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 10 }
      })
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'f2', name: 'finish_task', input: {} }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 10 }
      });

    (createExecutorAdapter as any).mockReturnValue({
      name: 'test',
      modelId: 'test-model',
      chat: chatMock,
    });

    (handleToolCall as any).mockResolvedValue('tool result output');

    await executePlan('Test plan with tool');

    expect(chatMock).toHaveBeenCalledTimes(2);
    expect(handleToolCall).toHaveBeenCalledWith('read_file', { file_path: 'test.ts' });
  });

  describe('trimMessages', () => {
    it('should safely trim messages without orphaning tool results', () => {
      const messages: NormalizedMessage[] = [
        { role: 'user', content: 'Initial prompt' },
        { role: 'assistant', content: 'Thinking...' },
        { role: 'user', content: 'More info' },
        ...Array(20).fill({ role: 'user', content: 'spam' }),
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't1', name: 'read_file', input: {} }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'data' }],
        },
        { role: 'assistant', content: 'Done' },
      ];

      expect(messages.length).toBe(26);

      // Asking for max 3 would try to take [24, 25].
      // But 24 is tool_result — must expand to include 23 (tool_use).
      const trimmed = trimMessages(messages, 3);

      expect(trimmed.length).toBe(4);
      expect(trimmed[0].content).toBe('Initial prompt');
      expect((trimmed[1].content as any[])[0].type).toBe('tool_use');
      expect((trimmed[2].content as any[])[0].type).toBe('tool_result');
      expect(trimmed[3].content).toBe('Done');
    });
  });
});
