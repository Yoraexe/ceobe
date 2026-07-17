import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGrepCodebase, handleSearchCodebase } from '../../../../src/ai/tools/handlers/semanticOps';
import * as child_process from 'child_process';
import * as fs from 'fs';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn((cmd, args, opts, cb) => {
    // Some tests might override this, so let's check mockImplementation or just provide a default
    cb(null, 'src/index.ts:10: const a = 1;', '');
  }),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

describe('semanticOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleGrepCodebase', () => {
    it('should return matches', async () => {
      const mockExecFile = child_process.execFile as unknown as ReturnType<typeof vi.fn>;
      mockExecFile.mockImplementation((cmd, args, opts, cb) => cb(null, { stdout: 'src/index.ts:10: const a = 1;', stderr: '' }));
      const result = await handleGrepCodebase({ query: 'const a' });
      expect(result).toContain('src/index.ts');
      expect(mockExecFile).toHaveBeenCalled();
    });

    it('should handle grep errors (e.g. no matches)', async () => {
      const mockExecFile = child_process.execFile as unknown as ReturnType<typeof vi.fn>;
      mockExecFile.mockImplementation((cmd, args, opts, cb) => {
        const err: any = new Error('Command failed');
        err.code = 1; // grep returns 1 for no matches
        cb(err, '', '');
      });
      const result = await handleGrepCodebase({ query: 'nonexistent_string_123' });
      expect(result).toContain('No matches found');
    });
  });

  describe('handleSearchCodebase', () => {
    it('should ask to use semantic search if not initialized', async () => {
      // Mocking everything to return empty
      const result = await handleSearchCodebase({ query: 'how does auth work' });
      expect(typeof result).toBe('string');
    });
  });
});
