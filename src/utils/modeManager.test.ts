import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as readline from 'readline';
import { readConfig, writeConfig, setMode, printModeBadge, confirmToolCall, SENSITIVE_TOOLS, clearConfigCacheForTesting } from './modeManager';

vi.mock('fs');
vi.mock('readline');

describe('modeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigCacheForTesting();
  });

  it('readConfig should return default if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const config = readConfig();
    expect(config.mode).toBe('ask');
  });

  it('readConfig should return file content if exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ mode: 'autonomous', updatedAt: 'now' }));
    const config = readConfig();
    expect(config.mode).toBe('autonomous');
  });

  it('readConfig should return default on parse error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid-json');
    const config = readConfig();
    expect(config.mode).toBe('ask');
  });

  it('writeConfig should create dir and write file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    writeConfig({ mode: 'ask', updatedAt: 'now' });
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('getActiveMode and setMode should work', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    setMode('autonomous');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String), 
      expect.stringContaining('autonomous'), 
      expect.objectContaining({ encoding: 'utf8' })
    );
  });

  it('printModeBadge should output to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(false);
    printModeBadge(); // ask by default now
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('BERTANYA'));
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ mode: 'autonomous' }));
    clearConfigCacheForTesting();
    printModeBadge(); // autonomous
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('OTONOM'));
    spy.mockRestore();
  });

  it('SENSITIVE_TOOLS should contain expected tools', () => {
    expect(SENSITIVE_TOOLS.has('write_file')).toBe(true);
    expect(SENSITIVE_TOOLS.has('execute_command')).toBe(true);
  });

  describe('confirmToolCall', () => {
    it('should return true if user types y', async () => {
      const mockRl = {
        question: vi.fn().mockImplementation((_q, cb) => cb('y')),
        close: vi.fn(),
        on: vi.fn()
      };
      vi.mocked(readline.createInterface).mockReturnValue(mockRl as any);

      const result = await confirmToolCall('write_file', { file_path: 'test.ts' });
      expect(result).toBe(true);
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should return false if user types n', async () => {
      const mockRl = {
        question: vi.fn().mockImplementation((_q, cb) => cb('n')),
        close: vi.fn(),
        on: vi.fn()
      };
      vi.mocked(readline.createInterface).mockReturnValue(mockRl as any);

      const result = await confirmToolCall('delete_file', { file_path: 'test.ts' });
      expect(result).toBe(false);
    });

    it('should reject if user types a', async () => {
      const mockRl = {
        question: vi.fn().mockImplementation((_q, cb) => cb('a')),
        close: vi.fn(),
        on: vi.fn()
      };
      vi.mocked(readline.createInterface).mockReturnValue(mockRl as any);

      await expect(confirmToolCall('execute_command', { command: 'ls' })).rejects.toThrow('USER_ABORT');
    });

    it('should handle various tool summaries', async () => {
      const mockRl = {
        question: vi.fn().mockImplementation((_q, cb) => cb('y')),
        close: vi.fn(),
        on: vi.fn()
      };
      vi.mocked(readline.createInterface).mockReturnValue(mockRl as any);

      await confirmToolCall('rename_file', { old_path: 'a', new_path: 'b' });
      await confirmToolCall('move_file', { source_path: 'a', destination_path: 'b' });
      await confirmToolCall('start_background_service', { service_id: 's', command: 'c' });
      await confirmToolCall('unknown_tool', { data: 'val' });
    });
  });
});
