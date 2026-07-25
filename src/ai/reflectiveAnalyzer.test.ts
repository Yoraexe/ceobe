import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeExecutionLog } from './reflectiveAnalyzer';
import * as fs from 'fs';
import * as router from './providers/router';

vi.mock('fs');
vi.mock('./providers/router');

describe('Reflective Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if execution.log does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = await analyzeExecutionLog();
    expect(result).toBeNull();
  });

  it('should parse log, generate reflection report, and auto-draft skill', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 100 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[2026-07-26] Execution log text <test>');
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined as any);
    vi.spyOn(fs, 'writeFileSync').mockReturnValue();

    const mockGenerate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        period: { from: '2026-07-26', to: '2026-07-26' },
        efficiencyScore: 85,
        patterns: ['Repeated file edit'],
        suggestedSkills: ['--my-custom-skill--'],
        costOutliers: []
      }),
      usage: { input_tokens: 20, output_tokens: 40 }
    });

    vi.spyOn(router, 'createProviderAdapter').mockReturnValue({
      name: 'gemini',
      modelId: 'test-model',
      generate: mockGenerate
    } as any);

    const report = await analyzeExecutionLog(true);
    expect(report).not.toBeNull();
    expect(report?.efficiencyScore).toBe(85);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should handle unparseable LLM output gracefully with defaults', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 100 } as any);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('[2026-07-26] Execution log text');

    vi.spyOn(router, 'createProviderAdapter').mockReturnValue({
      name: 'gemini',
      modelId: 'test-model',
      generate: vi.fn().mockResolvedValue({ text: 'invalid response' })
    } as any);

    const report = await analyzeExecutionLog(false);
    expect(report).not.toBeNull();
    expect(report?.efficiencyScore).toBe(100);
    expect(report?.patterns[0]).toContain('Could not parse');
  });
});
