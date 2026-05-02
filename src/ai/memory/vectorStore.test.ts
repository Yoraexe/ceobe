import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { cosineSimilarity, saveEmbeddings, loadEmbeddings, searchEmbeddings } from './vectorStore';

vi.mock('fs');
vi.mock('../../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));

describe('vectorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cosineSimilarity should calculate correct similarity', () => {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    
    expect(cosineSimilarity(vecA, vecB)).toBe(1);
    expect(cosineSimilarity(vecA, vecC)).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('saveEmbeddings should create dir and write file', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdirMock = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const writeMock = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    
    saveEmbeddings([{ id: '1', filePath: 'test.ts', chunkIndex: 0, content: 'code', embedding: [0.5] }]);
    
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalled();
  });

  it('loadEmbeddings should return empty array if no file', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(loadEmbeddings()).toEqual([]);
  });

  it('loadEmbeddings should return parsed JSON', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[{"id":"1"}]');
    expect(loadEmbeddings()).toEqual([{ id: '1' }]);
  });

  it('searchEmbeddings should sort by score descending', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    // Return two chunks: chunk 1 is exactly the query, chunk 2 is orthogonal
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify([
      { id: '1', embedding: [1, 0] },
      { id: '2', embedding: [0, 1] }
    ]));
    
    const results = searchEmbeddings([1, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].chunk.id).toBe('1');
    expect(results[0].score).toBe(1);
    expect(results[1].chunk.id).toBe('2');
    expect(results[1].score).toBe(0);
  });
});
