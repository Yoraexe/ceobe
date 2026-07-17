import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleExecuteCommand, handleStartBackgroundService, handleStopBackgroundService, activeBackgroundProcesses } from '../../../../src/ai/tools/handlers/shellOps';
import * as child_process from 'child_process';

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

describe('shellOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const pid of activeBackgroundProcesses.keys()) {
      activeBackgroundProcesses.delete(pid);
    }
  });

  describe('handleExecuteCommand', () => {
    it('should block cd command', async () => {
      const result = await handleExecuteCommand({ command: 'cd ..' });
      expect(result).toContain('Command blocked');
    });

    it('should execute normal command', async () => {
      const mockExec = child_process.exec as unknown as ReturnType<typeof vi.fn>;
      mockExec.mockImplementation((...args) => {
        const callback = args[args.length - 1];
        callback(null, { stdout: 'mock stdout', stderr: '' }); 
      });

      const result = await handleExecuteCommand({ command: 'npm -v' });
      expect(result).toContain('mock stdout');
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('Background Services', () => {
    it('should start a background service', async () => {
      const mockSpawn = child_process.spawn as unknown as ReturnType<typeof vi.fn>;
      const mockChild = {
        pid: 1234,
        exitCode: null,
        stdout: { on: vi.fn(), setEncoding: vi.fn() },
        stderr: { on: vi.fn(), setEncoding: vi.fn() },
        on: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockChild);

      const result = await handleStartBackgroundService({ service_id: 'test_srv', command: 'npm run start' });
      expect(result).toContain('test_srv');
      expect(activeBackgroundProcesses.has('test_srv')).toBe(true);
    });

    it('should stop a background service', async () => {
      const mockKill = vi.fn();
      const mockChild = { kill: mockKill };
      activeBackgroundProcesses.set('test_srv_2', mockChild as any);

      const result = await handleStopBackgroundService({ service_id: 'test_srv_2' });
      expect(result).toContain('test_srv_2');
      expect(mockKill).toHaveBeenCalled();
      expect(activeBackgroundProcesses.has('test_srv_2')).toBe(false);
    });
  });
});
