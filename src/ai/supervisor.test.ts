import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as planner from './planner';
import * as executor from './executor';
import { runAutonomousLoop, computeChangedDocs } from './supervisor';

vi.mock('fs');
vi.mock('../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));
vi.mock('./planner');
vi.mock('./executor');
vi.mock('../utils/stateManager', () => ({
  markPhaseComplete: vi.fn(),
  readState: vi.fn().mockReturnValue(null),
  getCompletedFiles: vi.fn().mockReturnValue([])
}));
vi.mock('./memory/indexer', () => ({
  indexWorkspace: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../utils/costTracker', () => ({
  resetSession: vi.fn(),
  printCostSummary: vi.fn()
}));
vi.mock('../utils/gitManager', () => ({
  createSnapshot: vi.fn(),
  rollbackToSnapshot: vi.fn(),
  getChangedFiles: vi.fn().mockResolvedValue([])
}));
vi.mock('./taskParser', () => ({
  parseTaskWaves: vi.fn().mockImplementation((finalTask: string) => [{ wave: 1, tasks: [{ title: 'task', content: finalTask }] }])
}));
vi.mock('../utils/context', () => ({
  getProjectDir: vi.fn().mockReturnValue('/mock'),
  log: vi.fn(),
  executionContext: {
    getStore: vi.fn().mockReturnValue({ snapshots: new Map() })
  }
}));
vi.mock('../utils/contextLoader', () => ({
  readCeobeRules: vi.fn().mockReturnValue('mock rules'),
  readSpecificSkills: vi.fn().mockReturnValue('mock skills')
}));
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn((_cmd, _opts, cb) => cb(null, { stdout: 'mock stdout', stderr: '' })),
  execFile: vi.fn((_cmd, _args, _opts, cb) => cb(null, { stdout: '', stderr: '' }))
}));

// Mock loopHandlers
export const mockAskUserConfirmation = vi.fn();
vi.mock('./utils/loopHandlers', () => ({
  askUserConfirmation: (...args: any[]) => mockAskUserConfirmation(...args),
  handleSessionResume: vi.fn().mockResolvedValue('plan'),
  cleanupBackgroundProcesses: vi.fn(),
  runPolyglotVerification: vi.fn()
}));

// Mock readline (can be kept for legacy, though not strictly needed if askUserConfirmation is mocked)
const mockClose = vi.fn();
const mockQuestion = vi.fn();
vi.mock('readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: (...args: any[]) => mockQuestion(...args),
    close: (...args: any[]) => mockClose(...args)
  })
}));

// Mock console to avoid spam
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('supervisor', () => {
  let c = 0;
  beforeEach(() => {
    vi.clearAllMocks();
    c = 0;
    computeChangedDocs({}, true);
  });

  it('should run successfully on first audit pass', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockImplementation(async () => `brd${++c}`);
    vi.spyOn(planner, 'generateDesignSpec').mockImplementation(async () => `design${++c}`);
    vi.spyOn(planner, 'generateArchitecture').mockImplementation(async () => `arch${++c}`);
    vi.spyOn(planner, 'generateImplementationPlan').mockImplementation(async () => `task${++c}`);
    vi.spyOn(planner, 'generateDevOpsConfig').mockImplementation(async () => `devops${++c}`);
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    await runAutonomousLoop('test desc');
    
    expect(planner.generateBRD).toHaveBeenCalledTimes(1);
    expect(planner.generateDesignSpec).toHaveBeenCalledTimes(1);
    expect(executor.executeWaves).toHaveBeenCalledTimes(1);
    expect(executor.executeWaves).toHaveBeenCalledWith('task5\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\ndevops4', [], '');
    expect(planner.generateDevOpsConfig).toHaveBeenCalledTimes(1);
  });

  it('should retry if audit fails and eventually pass', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockImplementation(async () => `brd${++c}`);
    vi.spyOn(planner, 'generateDesignSpec').mockImplementation(async () => `design${++c}`);
    vi.spyOn(planner, 'generateArchitecture').mockImplementation(async () => `arch${++c}`);
    vi.spyOn(planner, 'generateImplementationPlan').mockImplementation(async () => `task${++c}`);
    vi.spyOn(planner, 'generateDevOpsConfig').mockImplementation(async () => `devops${++c}`);
    
    // Fail once, pass second time
    vi.spyOn(planner, 'auditPlan')
      .mockResolvedValueOnce({ passed: false, feedback: 'fix this' })
      .mockResolvedValueOnce({ passed: true });
    
    await runAutonomousLoop('test desc');
    
    expect(planner.generateBRD).toHaveBeenCalledTimes(2);
    // Second call should pass feedback
    expect(planner.generateBRD).toHaveBeenNthCalledWith(2, 'test desc', [], 'fix this');
    expect(executor.executeWaves).toHaveBeenCalledTimes(1);
  });

  it('should abort after MAX_RETRIES (3) failures', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    let c = 0;
    vi.spyOn(planner, 'generateBRD').mockImplementation(async () => `brd${++c}`);
    vi.spyOn(planner, 'generateDesignSpec').mockImplementation(async () => `design${++c}`);
    vi.spyOn(planner, 'generateArchitecture').mockImplementation(async () => `arch${++c}`);
    vi.spyOn(planner, 'generateImplementationPlan').mockImplementation(async () => `impl${++c}`);
    vi.spyOn(planner, 'generateDevOpsConfig').mockImplementation(async () => `devops${++c}`);
    
    // Always fail
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: false, feedback: 'bad' });
    
    await expect(runAutonomousLoop('test desc')).rejects.toThrow('Maximum auto-correction retries (3) reached. Audit still failing.');
    
    // 1 initial try + 2 retries (0, 1, 2 = 3 times total)
    expect(planner.generateBRD).toHaveBeenCalledTimes(3);
    expect(executor.executeWaves).not.toHaveBeenCalled();
  });

  it('should ask for confirmation if askBeforeExecute is true and proceed if yes', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockImplementation(async () => `brd${++c}`);
    vi.spyOn(planner, 'generateDesignSpec').mockImplementation(async () => `design${++c}`);
    vi.spyOn(planner, 'generateArchitecture').mockImplementation(async () => `arch${++c}`);
    vi.spyOn(planner, 'generateImplementationPlan').mockImplementation(async () => `task${++c}`);
    vi.spyOn(planner, 'generateDevOpsConfig').mockImplementation(async () => `devops${++c}`);
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    mockAskUserConfirmation.mockResolvedValue(true);
    
    await runAutonomousLoop('test desc', true);
    
    expect(mockAskUserConfirmation).toHaveBeenCalled();
    expect(executor.executeWaves).toHaveBeenCalledTimes(1);
  });

  it('should ask for confirmation and abort if no', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockImplementation(async () => `brd${++c}`);
    vi.spyOn(planner, 'generateDesignSpec').mockImplementation(async () => `design${++c}`);
    vi.spyOn(planner, 'generateArchitecture').mockImplementation(async () => `arch${++c}`);
    vi.spyOn(planner, 'generateImplementationPlan').mockImplementation(async () => `task${++c}`);
    vi.spyOn(planner, 'generateDevOpsConfig').mockImplementation(async () => `devops${++c}`);
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    mockAskUserConfirmation.mockResolvedValue(false);
    
    await runAutonomousLoop('test desc', true);
    
    expect(mockAskUserConfirmation).toHaveBeenCalled();
    expect(executor.executePlan).not.toHaveBeenCalled();
  });
});
