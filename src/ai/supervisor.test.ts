import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as planner from './planner';
import * as executor from './executor';
import { runAutonomousLoop } from './supervisor';

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
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => cb(null, { stdout: 'mock stdout', stderr: '' }))
}));

// Mock readline
export const mockClose = vi.fn();
export const mockQuestion = vi.fn();
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run successfully on first audit pass', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockResolvedValue('brd');
    vi.spyOn(planner, 'generateDesignSpec').mockResolvedValue('design');
    vi.spyOn(planner, 'generateArchitecture').mockResolvedValue('arch');
    vi.spyOn(planner, 'generateImplementationPlan').mockResolvedValue('task');
    vi.spyOn(planner, 'generateDevOpsConfig').mockResolvedValue('devops');
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    await runAutonomousLoop('test desc');
    
    expect(planner.generateBRD).toHaveBeenCalledTimes(1);
    expect(planner.generateDesignSpec).toHaveBeenCalledTimes(1);
    expect(executor.executePlan).toHaveBeenCalledTimes(1);
    expect(executor.executePlan).toHaveBeenCalledWith('task\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\ndevops', 'arch', 'design');
    expect(planner.generateDevOpsConfig).toHaveBeenCalledTimes(1);
  });

  it('should retry if audit fails and eventually pass', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockResolvedValue('brd');
    vi.spyOn(planner, 'generateDesignSpec').mockResolvedValue('design');
    vi.spyOn(planner, 'generateArchitecture').mockResolvedValue('arch');
    vi.spyOn(planner, 'generateImplementationPlan').mockResolvedValue('task');
    vi.spyOn(planner, 'generateDevOpsConfig').mockResolvedValue('devops');
    
    // Fail once, pass second time
    vi.spyOn(planner, 'auditPlan')
      .mockResolvedValueOnce({ passed: false, feedback: 'fix this' })
      .mockResolvedValueOnce({ passed: true });
    
    await runAutonomousLoop('test desc');
    
    expect(planner.generateBRD).toHaveBeenCalledTimes(2);
    // Second call should pass feedback
    expect(planner.generateBRD).toHaveBeenNthCalledWith(2, 'test desc', [], 'fix this');
    expect(executor.executePlan).toHaveBeenCalledTimes(1);
  });

  it('should abort after MAX_RETRIES (3) failures', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockResolvedValue('brd');
    vi.spyOn(planner, 'generateDesignSpec').mockResolvedValue('design');
    vi.spyOn(planner, 'generateArchitecture').mockResolvedValue('arch');
    vi.spyOn(planner, 'generateImplementationPlan').mockResolvedValue('task');
    
    // Always fail
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: false, feedback: 'bad' });
    
    await runAutonomousLoop('test desc');
    
    // 1 initial try + 3 retries = 4 times
    expect(planner.generateBRD).toHaveBeenCalledTimes(4);
    expect(executor.executePlan).not.toHaveBeenCalled();
  });

  it('should ask for confirmation if askBeforeExecute is true and proceed if yes', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockResolvedValue('brd');
    vi.spyOn(planner, 'generateDesignSpec').mockResolvedValue('design');
    vi.spyOn(planner, 'generateArchitecture').mockResolvedValue('arch');
    vi.spyOn(planner, 'generateImplementationPlan').mockResolvedValue('task');
    vi.spyOn(planner, 'generateDevOpsConfig').mockResolvedValue('devops');
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    mockQuestion.mockImplementation((q, cb) => cb('y'));
    
    await runAutonomousLoop('test desc', true);
    
    expect(mockQuestion).toHaveBeenCalled();
    expect(executor.executePlan).toHaveBeenCalledTimes(1);
  });

  it('should ask for confirmation and abort if no', async () => {
    vi.spyOn(planner, 'selectRelevantSkills').mockResolvedValue([]);
    vi.spyOn(planner, 'generateBRD').mockResolvedValue('brd');
    vi.spyOn(planner, 'generateDesignSpec').mockResolvedValue('design');
    vi.spyOn(planner, 'generateArchitecture').mockResolvedValue('arch');
    vi.spyOn(planner, 'generateImplementationPlan').mockResolvedValue('task');
    vi.spyOn(planner, 'auditPlan').mockResolvedValue({ passed: true });
    
    mockQuestion.mockImplementation((q, cb) => cb('n'));
    
    await runAutonomousLoop('test desc', true);
    
    expect(mockQuestion).toHaveBeenCalled();
    expect(executor.executePlan).not.toHaveBeenCalled();
  });
});
