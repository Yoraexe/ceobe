import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

// Mock fs so tests don't touch the real filesystem
vi.mock('fs');
vi.mock('chalk', () => ({
  default: {
    bgGreen: { black: { bold: (s: string) => s } },
    bgYellow: { black: { bold: (s: string) => s } },
    green: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    red: (s: string) => s,
  },
}));

import {
  readConfig,
  writeConfig,
  getActiveMode,
  setMode,
  SENSITIVE_TOOLS,
  type CeobeConfig,
} from './modeManager';

describe('modeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readConfig', () => {
    it('should return default autonomous mode if config file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      const config = readConfig();
      expect(config.mode).toBe('autonomous');
    });

    it('should return parsed config if file exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      const mockConfig: CeobeConfig = { mode: 'ask', updatedAt: '2026-01-01T00:00:00Z' };
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConfig));
      const config = readConfig();
      expect(config.mode).toBe('ask');
    });

    it('should return default config if JSON is malformed', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('NOT_VALID_JSON{{{');
      const config = readConfig();
      expect(config.mode).toBe('autonomous');
    });
  });

  describe('writeConfig', () => {
    it('should call mkdirSync and writeFileSync when writing config', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      (fs.writeFileSync as any).mockReturnValue(undefined);

      const config: CeobeConfig = { mode: 'ask', updatedAt: new Date().toISOString() };
      writeConfig(config);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('getActiveMode', () => {
    it('should return autonomous by default', () => {
      (fs.existsSync as any).mockReturnValue(false);
      expect(getActiveMode()).toBe('autonomous');
    });

    it('should return ask when config is set to ask', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({ mode: 'ask', updatedAt: '' }));
      expect(getActiveMode()).toBe('ask');
    });
  });

  describe('setMode', () => {
    it('should write a config file with the new mode', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.writeFileSync as any).mockReturnValue(undefined);

      setMode('ask');
      expect(fs.writeFileSync).toHaveBeenCalled();
      const callArgs = (fs.writeFileSync as any).mock.calls[0];
      const written = JSON.parse(callArgs[1]);
      expect(written.mode).toBe('ask');
    });
  });

  describe('SENSITIVE_TOOLS', () => {
    it('should flag write_file as sensitive', () => {
      expect(SENSITIVE_TOOLS.has('write_file')).toBe(true);
    });
    it('should flag execute_command as sensitive', () => {
      expect(SENSITIVE_TOOLS.has('execute_command')).toBe(true);
    });
    it('should flag delete_file as sensitive', () => {
      expect(SENSITIVE_TOOLS.has('delete_file')).toBe(true);
    });
    it('should NOT flag read_file as sensitive', () => {
      expect(SENSITIVE_TOOLS.has('read_file')).toBe(false);
    });
    it('should NOT flag semantic_search as sensitive', () => {
      expect(SENSITIVE_TOOLS.has('semantic_search')).toBe(false);
    });
  });
});
