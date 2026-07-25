import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMcpServer } from './server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../ai/pentest/pentestSupervisor', () => ({
  runPentestLoop: vi.fn().mockResolvedValue(undefined)
}));

describe('mcp server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register MCP tools and connect to stdio transport', async () => {
    const mockTool = vi.fn();
    const mockPrompt = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue(undefined);

    vi.mocked(McpServer).mockImplementation(() => ({
      tool: mockTool,
      prompt: mockPrompt,
      connect: mockConnect,
    } as any));

    vi.spyOn(console, 'error').mockImplementation(() => {});

    await runMcpServer();

    expect(process.env.CEOBE_MCP_MODE).toBe('true');
    expect(mockPrompt).toHaveBeenCalledWith(
      'ceobe-engineering-rules',
      expect.any(String),
      expect.any(Function)
    );
    expect(mockTool).toHaveBeenCalledWith('check_tool_status', expect.any(String), expect.any(Object), expect.any(Function));
    expect(mockTool).toHaveBeenCalledWith('run_pentest', expect.any(String), expect.any(Object), expect.any(Function));
    expect(mockConnect).toHaveBeenCalled();
  });
});
