// Tujuan: Unit testing untuk modul stateManager.ts.
// Caller: vitest runner
// Dependensi: vitest, fs, stateManager
// Main Functions: -
// Side Effects: Mocking filesystem dan proper-lockfile

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { readState, writeState, markPhaseComplete, markFileComplete, getCompletedFiles, clearStateCache } from './stateManager';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn()
  }
}));

vi.mock('proper-lockfile', () => ({
  default: {
    lock: vi.fn().mockResolvedValue(() => Promise.resolve())
  }
}));

vi.mock('../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));

describe('stateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStateCache();
  });

  it('readState should return null if file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(await readState()).toBeNull();
  });

  it('readState should return parsed state if file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.readFile).mockResolvedValue('{"currentPhase":"plan"}' as any);
    
    expect(await readState()).toEqual({ currentPhase: 'plan' });
  });

  it('writeState should create directory, lock, and write file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.promises.readFile).mockResolvedValue('{"currentPhase":"plan"}' as any);
    
    await writeState({ currentPhase: 'execute' });
    
    expect(fs.promises.mkdir).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });

  it('markPhaseComplete should update phase', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
      currentPhase: 'plan',
      completedPhases: []
    }) as any);
    
    await markPhaseComplete('plan', 'execute');
    
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('tmp'),
      expect.stringContaining('"execute"'),
      'utf8'
    );
  });

  it('markFileComplete should update files list', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
      completedFiles: []
    }) as any);

    await markFileComplete('src/index.ts');
    
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('tmp'),
      expect.stringContaining('src/index.ts'),
      'utf8'
    );
  });

  it('getCompletedFiles should return list from state', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ completedFiles: ['src/index.ts'] }) as any);
    const files = await getCompletedFiles();
    expect(files).toContain('src/index.ts');
  });
});
