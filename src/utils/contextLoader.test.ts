import { describe, it, expect } from 'vitest';
import { readCeobeRules, getAvailableSkills, readTemplate, readSpecificSkills } from './contextLoader';

describe('contextLoader', () => {
  it('should get available skills without throwing', () => {
    const skills = getAvailableSkills();
    expect(Array.isArray(skills)).toBe(true);
  });

  it('should read Ceobe rules without throwing', () => {
    const rules = readCeobeRules();
    expect(typeof rules).toBe('string');
  });

  it('should read template without throwing', () => {
    const tmpl = readTemplate('brd-template.md');
    expect(typeof tmpl).toBe('string');
  });

  it('should read specific skills without throwing', () => {
    const tmpl = readSpecificSkills(['react-nextjs']);
    expect(typeof tmpl).toBe('string');
  });
});
