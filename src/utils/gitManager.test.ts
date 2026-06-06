import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as child_process from 'child_process';
import { createSnapshot, rollbackToSnapshot, isGitRepo } from './gitManager';
import { getProjectDir } from './context';


vi.mock('child_process', () => {
  return { exec: vi.fn() };
});

vi.mock('./context');

describe('gitManager', () => {
  let execMock: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    execMock = vi.mocked(child_process.exec) as any;
    vi.mocked(getProjectDir).mockReturnValue('/mock/dir');
  });

  describe('isGitRepo', () => {
    it('should return true if git rev-parse succeeds', async () => {
      execMock.mockImplementation(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '', stderr: '' }); }) as any);
      const result = await isGitRepo();
      expect(result).toBe(true);
    });

    it('should return false if git rev-parse fails', async () => {
      execMock.mockImplementation(((...args: any[]) => { const cb = args[args.length - 1]; cb(new Error('fail'), { stdout: '', stderr: '' }); }) as any);
      const result = await isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('createSnapshot', () => {
    it('should execute git rev-parse HEAD and return hash', async () => {
      execMock
        .mockImplementationOnce(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '', stderr: '' }); }) as any) // isGitRepo
        .mockImplementationOnce(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '', stderr: '' }); }) as any) // hasChanges
        .mockImplementationOnce(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '0123456789abcdef0123456789abcdef01234567\n', stderr: '' }); }) as any); // git rev-parse HEAD
        
      const snapshot = await createSnapshot();
      expect(snapshot).toBe('0123456789abcdef0123456789abcdef01234567');
    });

    it('should return null if not a git repo', async () => {
      execMock.mockImplementation(((...args: any[]) => { const cb = args[args.length - 1]; cb(new Error('not a repo'), { stdout: '', stderr: '' }); }) as any);
      const snapshot = await createSnapshot();
      expect(snapshot).toBeNull();
    });
  });

  describe('rollbackToSnapshot', () => {
    it('should execute git reset --hard', async () => {
      execMock
        .mockImplementationOnce(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '', stderr: '' }); }) as any) // isGitRepo
        .mockImplementationOnce(((...args: any[]) => { const cb = args[args.length - 1]; cb(null, { stdout: '', stderr: '' }); }) as any); // git reset
        
      await rollbackToSnapshot('0123456789abcdef0123456789abcdef01234567');
      expect(execMock).toHaveBeenCalledWith('git reset --hard 0123456789abcdef0123456789abcdef01234567', expect.any(Object), expect.any(Function));
    });

    it('should do nothing if not a git repo', async () => {
      execMock.mockImplementation(((...args: any[]) => { const cb = args[args.length - 1]; cb(new Error('not a repo'), { stdout: '', stderr: '' }); }) as any);
      await rollbackToSnapshot('0123456789abcdef0123456789abcdef01234567');
      expect(execMock).toHaveBeenCalledTimes(1); // only isGitRepo is called
    });
  });
});
