import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readCeobeRules, getAvailableSkills, readTemplate, readSpecificSkills, loadAdditionalContexts } from './contextLoader';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');
vi.mock('./context', () => ({
  getProjectDir: () => '/mock/dir',
  log: () => {},
}));

describe('contextLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get available skills without throwing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['skill1.md', 'skill2.md'] as unknown as fs.Dirent[]);
    vi.mocked(fs.readFileSync).mockReturnValue('# Skill Title');
    
    const skills = getAvailableSkills();
    expect(Array.isArray(skills)).toBe(true);
  });

  it('should read Ceobe rules without throwing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('rules');
    
    const rules = readCeobeRules();
    expect(rules).toContain('rules');
  });

  describe('Path Traversal Prevention (H-12)', () => {
    it('should block path traversal outside skills directory in readSpecificSkills', () => {
      // It should just ignore the invalid skill path and return empty
      const res = readSpecificSkills(['../../../etc/shadow']);
      expect(res).toBe('');
    });

    it('should block path traversal outside templates directory in readTemplate', () => {
      const res = readTemplate('../../../etc/shadow');
      expect(res).toBe('');
    });
  });
});
