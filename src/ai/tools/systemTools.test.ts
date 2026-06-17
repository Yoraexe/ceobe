// Tujuan: Unit testing untuk modul systemTools.ts.
// Caller: vitest runner
// Dependensi: vitest, fs, path, systemTools, env, browserAutomation, vectorStore, indexer
// Main Functions: -
// Side Effects: Mocking filesystem, child_process, dan browser

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleToolCall } from './systemTools';
import { env, reloadEnv } from '../../config/env';
import * as browser from '../../utils/browserAutomation';
import * as vectorStore from '../memory/vectorStore';
import * as indexer from '../memory/indexer';
vi.mock('fs');
vi.mock('../../utils/browserAutomation');
vi.mock('../memory/vectorStore');
vi.mock('../memory/indexer');
export const mockExec = vi.fn((_cmd, _opts, callback) => {
  callback(null, { stdout: 'mocked stdout', stderr: '' });
});
export const mockSpawn = vi.fn().mockReturnValue({ exitCode: null, kill: vi.fn() });
vi.mock('child_process', () => ({
  exec: (cmd: string, opts: any, callback: any) => mockExec(cmd, opts, callback),
  spawn: (cmd: string, opts: any) => mockSpawn(cmd, opts)
}));
vi.mock('../../utils/context', () => ({
  getProjectDir: vi.fn(() => require('path').resolve('./mock-workspace'))
}));
describe('systemTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getProjectDir mock should be set up via vi.mock instead
  });
  describe('handleToolCall', () => {
    it('read_file should block path traversal', async () => {
      const result = await handleToolCall('read_file', { file_path: '../../outside.txt' });
      expect(result).toContain('Path traversal blocked');
    });
    it('read_file should read valid file', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'statSync').mockReturnValue({ size: 100 } as any);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('file content');
      
      const validPath = path.resolve('./mock-workspace/valid.txt');
      const result = await handleToolCall('read_file', { file_path: validPath });
      expect(result).toBe('file content');
    });
    it('execute_command should block unwhitelisted commands', async () => {
      const result = await handleToolCall('execute_command', { command: 'rm -rf /' });
      expect(result).toContain('Command blocked');
    });
    it('execute_command should allow whitelisted commands', async () => {
      const result = await handleToolCall('execute_command', { command: 'npm install' });
      expect(result).toContain('STDOUT:\nmocked stdout');
    });
    it('delete_file should delete existing file', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
      
      const tempPath = path.resolve('./mock-workspace/temp.txt');
      const result = await handleToolCall('delete_file', { file_path: tempPath });
      expect(result).toContain('Successfully deleted');
    });
    it('search_in_files should return matches', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue(['test.ts'] as any);
      vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('hello world\nmatch this');
      
      const dirPath = path.resolve('./mock-workspace');
      const result = await handleToolCall('search_in_files', { dir_path: dirPath, query: 'match' });
      expect(result).toContain('match this');
    });
    it('visual_audit should return multimodal array', async () => {
      vi.spyOn(browser, 'executeBrowserInteraction').mockResolvedValue({
        base64Data: 'base64',
        mediaType: 'image/png',
        url: 'http://localhost',
        logs: ['log1'],
        content: 'page content'
      });
      const result = await handleToolCall('visual_audit', { url_or_path: 'http://localhost' }) as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].type).toBe('text');
      expect(result[1].type).toBe('image');
      expect(result[1].source.data).toBe('base64');
    });
    it('semantic_search should return mapped relevance string', async () => {
      vi.spyOn(indexer, 'getEmbedding').mockResolvedValue([0.1]);
      vi.spyOn(vectorStore, 'searchEmbeddings').mockReturnValue([
        { chunk: { id: '1', filePath: 'test.ts', chunkIndex: 0, content: 'code here', embedding: [0.1] }, score: 0.99 }
      ]);
      const result = await handleToolCall('semantic_search', { query: 'test query' });
      expect(result).toContain('Relevance Score: 0.990');
      expect(result).toContain('test.ts');
      expect(result).toContain('code here');
    });
    it('start_background_service should block unwhitelisted commands', async () => {
      const result = await handleToolCall('start_background_service', { service_id: 'test', command: 'rm -rf /' });
      expect(result).toContain('Command blocked');
    });
    it('start_background_service should handle immediate crash', async () => {
      mockSpawn.mockReturnValueOnce({ exitCode: 1, kill: vi.fn() });
      const result = await handleToolCall('start_background_service', { service_id: 'crash-test', command: 'node crash.js' });
      expect(result).toContain('crashed immediately');
    });
    it('stop_background_service should return error if service not found', async () => {
      const result = await handleToolCall('stop_background_service', { service_id: 'non-existent' });
      expect(result).toContain('No active service found');
    });
    it('execute_command should wrap in docker if sandbox enabled', async () => {
      process.env.CEOBE_SANDBOX = 'docker';
      reloadEnv();
      vi.spyOn(fs, 'existsSync').mockReturnValue(true); // mock go.mod foundexists
      
      mockExec.mockImplementationOnce((_cmd, _opts, cb) => cb(null, { stdout: 'docker out', stderr: '' }));
      await handleToolCall('execute_command', { command: 'go build' });
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('docker run --rm'), expect.anything(), expect.anything());
      
      process.env.CEOBE_SANDBOX = 'none';
      reloadEnv();
    });
  });
});