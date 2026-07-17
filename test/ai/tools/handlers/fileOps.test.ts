import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReadFile, handleWriteFile, handleCreateDirectory, validatePath } from '../../../../src/ai/tools/handlers/fileOps';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
    promises: {
      ...actual.promises,
      writeFile: vi.fn(),
      rename: vi.fn(),
    }
  };
});

describe('fileOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePath', () => {
    it('should throw on path traversal attempt', () => {
      expect(() => validatePath('../../../windows/system32')).toThrow(/Path traversal blocked/);
    });

    it('should return valid normalized path', () => {
      const validPath = validatePath('src/index.ts');
      expect(validPath.replace(/\\/g, '/')).toContain('ceobe/src/index.ts');
    });
  });

  describe('handleReadFile', () => {
    it('should read file content', async () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.statSync as any).mockReturnValue({ size: 100 });
      (fs.readFileSync as any).mockReturnValue('file content mock');
      
      const result = await handleReadFile({ file_path: 'test.txt' });
      expect(result).toBe('file content mock');
    });

    it('should handle file not found', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      const result = await handleReadFile({ file_path: 'missing.txt' });
      expect(result).toContain('not found');
    });
  });

  describe('handleWriteFile', () => {
    it('should write file content', async () => {
      const result = await handleWriteFile({ file_path: 'new.txt', content: 'hello' });
      expect(result).toContain('Successfully wrote');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('handleCreateDirectory', () => {
    it('should create directory if not exists', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      const result = await handleCreateDirectory({ dir_path: 'new_folder' });
      expect(result).toContain('Successfully created');
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
  });
});
