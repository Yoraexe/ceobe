// Tujuan: Unit testing untuk modul indexer.ts.
// Caller: vitest runner
// Dependensi: vitest, fs, indexer, vectorStore
// Main Functions: -
// Side Effects: Mocking filesystem dan Vector Store

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { getEmbedding, indexWorkspace } from './indexer';
import * as vectorStore from './vectorStore';

vi.mock('fs');
vi.mock('../../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));

vi.mock('../providers/embeddingAdapter', () => ({
  createEmbeddingAdapter: vi.fn().mockReturnValue({
    name: 'test',
    modelId: 'test-model',
    getEmbedding: vi.fn().mockResolvedValue([0.1, 0.2])
  })
}));

vi.mock('./vectorStore', () => ({
  saveEmbeddings: vi.fn(),
  loadEmbeddings: vi.fn().mockReturnValue([])
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue({ start: vi.fn().mockReturnThis(), succeed: vi.fn(), fail: vi.fn(), text: '' })
}));

vi.mock('chalk', () => ({
  default: { green: vi.fn((s) => s), red: vi.fn((s) => s) }
}));

describe('indexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getEmbedding should return vector array', async () => {
    const result = await getEmbedding('test text');
    expect(result).toEqual([0.1, 0.2]);
  });

  it('indexWorkspace should process files and save embeddings', async () => {
    // Mock directory structure
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockImplementation(((dir: any) => {
      if (dir.endsWith('workspace')) return ['src', 'node_modules'];
      if (dir.endsWith('src')) return ['main.ts'];
      return [];
    }) as any);
    vi.spyOn(fs, 'statSync').mockImplementation((p: any) => ({
      isDirectory: () => !p.endsWith('.ts'),
      isFile: () => p.endsWith('.ts'),
      size: 100,
      mtimeMs: Date.now()
    }) as any);
    
    vi.spyOn(fs, 'lstatSync').mockImplementation((p: any) => ({
      isDirectory: () => !p.endsWith('.ts'),
      isFile: () => p.endsWith('.ts'),
      isSymbolicLink: () => false,
      size: 100,
      mtimeMs: Date.now()
    }) as any);
    
    // Mock file content (small file, 1 chunk)
    vi.spyOn(fs, 'readFileSync').mockReturnValue('log("hello");');
    
    const saveSpy = vi.spyOn(vectorStore, 'saveEmbeddings');
    
    await indexWorkspace();
    
    // The embedding adapter should have been called (implied by savedChunks having the mocked vector)
    expect(saveSpy).toHaveBeenCalled();
    
    // Verify arguments passed to saveEmbeddings
    const savedChunks = saveSpy.mock.calls[0][0];
    expect(savedChunks.length).toBe(1);
    expect(savedChunks[0].content).toBe('log("hello");');
    expect(savedChunks[0].embedding).toEqual([0.1, 0.2]);
  });
});