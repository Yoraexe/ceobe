import { describe, it, expect } from 'vitest';
import { validateToolResult } from './toolValidator';

describe('Tool Validator', () => {
  it('should validate successful string results', async () => {
    const result = await validateToolResult('read_file', {}, 'const x = 1;');
    expect(result.valid).toBe(true);
    expect(result.enhancedResult).toBe('const x = 1;');
  });

  it('should invalidate explicit error strings', async () => {
    const result = await validateToolResult('execute_command', {}, 'Error: Command failed');
    expect(result.valid).toBe(false);
    expect(result.failureReason).toBe('Explicit error detected in tool output.');
    expect(result.enhancedResult).toContain('[TOOL_FAILED');
  });

  it('should invalidate mutating tools that do not report success', async () => {
    const result = await validateToolResult('write_file', {}, 'File created');
    // Does not include "Successfully"
    expect(result.valid).toBe(false);
    expect(result.enhancedResult).toContain('[TOOL_FAILED');
    expect(result.failureReason).toContain('success confirmation');
  });

  it('should validate mutating tools that report success', async () => {
    const result = await validateToolResult('write_file', {}, 'Successfully wrote to file');
    expect(result.valid).toBe(true);
  });

  it('should invalidate visual_audit returning string', async () => {
    const result = await validateToolResult('visual_audit', {}, 'Error loading page');
    expect(result.valid).toBe(false);
    expect(result.enhancedResult).toContain('[TOOL_FAILED');
  });

  it('should invalidate visual_audit returning empty array', async () => {
    const result = await validateToolResult('visual_audit', {}, []);
    expect(result.valid).toBe(false);
    expect((result.enhancedResult as any)[0].text).toContain('[TOOL_FAILED');
  });

  it('should validate valid visual_audit array', async () => {
    const result = await validateToolResult('visual_audit', {}, [{ type: 'text', text: 'Screenshot captured' }]);
    expect(result.valid).toBe(true);
  });
});
