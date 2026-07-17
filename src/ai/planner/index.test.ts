import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();

vi.mock('../providers/router', () => ({
  createProviderAdapter: vi.fn().mockReturnValue({
    name: 'gemini',
    modelId: 'gemini-mock',
    generate: (...args: any[]) => mockGenerate(...args)
  })
}));

vi.mock('../../utils/projectFileOps', () => ({
  readProjectFile: vi.fn().mockResolvedValue('project file content')
}));

vi.mock('../../utils/stateManager', () => ({
  readState: vi.fn().mockReturnValue({ phase: 1, currentTasks: [], completedTasks: [], openIssues: [] }),
  writeState: vi.fn()
}));

vi.mock('../../utils/contextLoader', () => ({
  getAvailableSkills: vi.fn().mockReturnValue(['mock-skill']),
  readCeobeRules: vi.fn().mockReturnValue('mock rules'),
  readSpecificSkills: vi.fn().mockReturnValue('mock skill context'),
  readTemplate: vi.fn().mockReturnValue('mock template')
}));

vi.mock('../../utils/costTracker', () => ({
  recordUsage: vi.fn(),
  checkBudget: vi.fn(),
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue({ start: vi.fn().mockReturnThis(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() })
}));

import { selectRelevantSkills, generateBRD, generateArchitecture, generateImplementationPlan, auditPlan } from './index';

describe('planner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selectRelevantSkills should return skills', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'mock-skill', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await selectRelevantSkills('test');
    expect(result).toEqual(['mock-skill']);
  });

  it('selectRelevantSkills should return empty array if none', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'none', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await selectRelevantSkills('test');
    expect(result).toEqual([]);
  });

  it('generateBRD should return text', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'brd content', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await generateBRD('test', ['skills']);
    expect(result).toBe('brd content');
  });

  it('generateArchitecture should return text', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'arch content', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await generateArchitecture('test', 'design', ['skills']);
    expect(result).toBe('arch content');
  });

  it('generateImplementationPlan should return text', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'plan content', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await generateImplementationPlan('test', ['skills']);
    expect(result).toBe('plan content');
  });

  it('generateBRD should pass auditorFeedback to prompt', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'brd content', usage: { input_tokens: 10, output_tokens: 10 } });
    await generateBRD('test', ['skills'], 'bad design');
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.stringContaining('bad design'),
      expect.any(Number)
    );
  });

  it('auditPlan should return true if approved', async () => {
    mockGenerate.mockResolvedValueOnce({ text: '<AUDIT_RESULT>APPROVED</AUDIT_RESULT>', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await auditPlan('test', '', ['skills']);
    expect(result.passed).toBe(true);
  });

  it('auditPlan should return false and feedback if not approved', async () => {
    mockGenerate.mockResolvedValueOnce({ text: 'Issues found', usage: { input_tokens: 10, output_tokens: 10 } });
    const result = await auditPlan('test', '', ['skills']);
    expect(result.passed).toBe(false);
    expect(result.feedback).toBe('Issues found');
  });
});
