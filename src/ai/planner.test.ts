import { describe, it, expect, vi, beforeEach } from 'vitest';

export const mockGenerateContent = vi.fn();

vi.mock('./geminiClient', () => {
  return {
    getGeminiClient: vi.fn().mockReturnValue({
      models: {
        generateContent: (...args: any[]) => mockGenerateContent(...args)
      }
    })
  };
});

vi.mock('../utils/contextLoader', () => ({
  getAvailableSkills: vi.fn().mockReturnValue(['mock-skill']),
  readCeobeRules: vi.fn().mockReturnValue('mock rules'),
  readSpecificSkills: vi.fn().mockReturnValue('mock skill context'),
  readTemplate: vi.fn().mockReturnValue('mock template')
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue({ start: vi.fn().mockReturnThis(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() })
}));

import { selectRelevantSkills, generateBRD, generateArchitecture, generateImplementationPlan, generateDesignSpec, generateDevOpsConfig, auditPlan } from './planner';

describe('planner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selectRelevantSkills should return skills', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'mock-skill' });
    const result = await selectRelevantSkills('test');
    expect(result).toEqual(['mock-skill']);
  });

  it('selectRelevantSkills should return empty array if none', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'none' });
    const result = await selectRelevantSkills('test');
    expect(result).toEqual([]);
  });

  it('generateBRD should return text', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'brd content' });
    const result = await generateBRD('test');
    expect(result).toBe('brd content');
  });

  it('generateArchitecture should return text', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'arch content' });
    const result = await generateArchitecture('test', 'design');
    expect(result).toBe('arch content');
  });

  it('generateImplementationPlan should return text', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'plan content' });
    const result = await generateImplementationPlan('test');
    expect(result).toBe('plan content');
  });

  it('generateBRD should pass auditorFeedback to prompt', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'brd content' });
    await generateBRD('test', [], 'bad design');
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.arrayContaining([
        expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('bad design')
            })
          ])
        })
      ])
    }));
  });

  it('auditPlan should return true if approved', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'APPROVED' });
    const result = await auditPlan('test');
    expect(result.passed).toBe(true);
  });

  it('auditPlan should return false and feedback if not approved', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'Issues found' });
    const result = await auditPlan('test');
    expect(result.passed).toBe(false);
    expect(result.feedback).toBe('Issues found');
  });
});
