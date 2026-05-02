import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { readState, writeState, markPhaseComplete } from './stateManager';

vi.mock('fs');
vi.mock('../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));

describe('stateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readState should return null if file does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(readState()).toBeNull();
  });

  it('readState should return parsed state if file exists', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => p.endsWith('json'));
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{"currentPhase":"plan"}');
    
    expect(readState()).toEqual({ currentPhase: 'plan' });
  });

  it('writeState should create lock, write file, and remove lock', () => {
    let lockCheckCount = 0;
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.endsWith('.lock')) {
        lockCheckCount++;
        return lockCheckCount > 1; // false for while loop, true for finally block
      }
      return false;
    });
    const writeFileSyncMock = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const unlinkSyncMock = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
    const mkdirSyncMock = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    
    writeState({ currentPhase: 'execute' });
    
    expect(mkdirSyncMock).toHaveBeenCalled();
    expect(writeFileSyncMock).toHaveBeenCalledWith(expect.stringContaining('.lock'), 'locked');
    expect(writeFileSyncMock).toHaveBeenCalledWith(expect.stringContaining('.json'), expect.stringContaining('"currentPhase": "execute"'), 'utf8');
    expect(unlinkSyncMock).toHaveBeenCalledWith(expect.stringContaining('.lock'));
  });

  it('markPhaseComplete should update phase', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      currentPhase: 'plan',
      completedPhases: []
    }));
    const writeFileSyncMock = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    
    markPhaseComplete('plan', 'execute');
    
    expect(writeFileSyncMock).toHaveBeenCalledWith(expect.stringContaining('.json'), expect.stringContaining('"execute"'), 'utf8');
  });
});
