import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePlan, trimMessages } from './executor';
import Anthropic from '@anthropic-ai/sdk';
import { handleToolCall } from './tools/systemTools';

vi.mock('@anthropic-ai/sdk');
vi.mock('./tools/systemTools', () => ({
  tools: [],
  handleToolCall: vi.fn()
}));
vi.mock('ora', () => {
  return {
    default: () => ({ start: vi.fn().mockReturnThis(), text: '', succeed: vi.fn(), fail: vi.fn() })
  };
});
vi.mock('chalk', () => ({
  default: { cyan: vi.fn((s) => s), yellow: vi.fn((s) => s), green: vi.fn((s) => s), red: vi.fn((s) => s) }
}));

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executePlan should execute plan and stop when no tools are called', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Task completed' }]
    });
    
    (Anthropic as any).mockImplementation(() => ({
      messages: { create: createMock }
    }));

    await executePlan('Test plan');
    
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('executePlan should loop and execute tools if requested by Claude', async () => {
    const createMock = vi.fn()
      .mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'I need to run a tool' },
          { type: 'tool_use', id: 'tool1', name: 'read_file', input: { file_path: 'test.ts' } }
        ]
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Done' }]
      });
    
    (Anthropic as any).mockImplementation(() => ({
      messages: { create: createMock }
    }));
    
    (handleToolCall as any).mockResolvedValue('tool result output');

    await executePlan('Test plan with tool');
    
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(handleToolCall).toHaveBeenCalledWith('read_file', { file_path: 'test.ts' });
  });

  describe('trimMessages', () => {
    it('should safely trim messages without orphaning tool results', () => {
      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: 'Initial prompt' }, // 0: Must keep
        { role: 'assistant', content: 'Thinking...' }, // 1
        { role: 'user', content: 'More info' }, // 2
        // We simulate a long history
        ...Array(20).fill({ role: 'user', content: 'spam' }), // 3 - 22
        { 
          role: 'assistant', 
          content: [{ type: 'tool_use', id: 't1', name: 'read_file', input: {} }] 
        }, // 23 (tool_use)
        { 
          role: 'user', 
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'data' }] 
        }, // 24 (tool_result)
        { role: 'assistant', content: 'Done' } // 25
      ];
      
      expect(messages.length).toBe(26);
      
      // If we ask for max 5, it should keep index 0, and try to take the last 4.
      // Last 4: [22, 23, 24, 25]. Wait, index 22 is 'spam'. Index 23 is tool_use.
      // Let's ask for max 4. It would take [23, 24, 25].
      // Let's ask for max 3. It would try to take [24, 25]. 
      // But 24 is tool_result! So it should expand backwards to include 23.
      
      const trimmed = trimMessages(messages, 3);
      
      // Should contain 0, 23, 24, 25 = 4 messages, because it had to expand.
      expect(trimmed.length).toBe(4);
      expect(trimmed[0].content).toBe('Initial prompt');
      expect((trimmed[1] as any).content[0].type).toBe('tool_use');
      expect((trimmed[2] as any).content[0].type).toBe('tool_result');
      expect(trimmed[3].content).toBe('Done');
    });
  });
});
