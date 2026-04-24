import { describe, it, expect } from 'vitest';
import { readCeobeRules, getAvailableSkills } from './contextLoader';

describe('contextLoader', () => {
  it('should get available skills without throwing', () => {
    const skills = getAvailableSkills();
    expect(Array.isArray(skills)).toBe(true);
  });

  it('should read Ceobe rules without throwing', () => {
    const rules = readCeobeRules();
    expect(typeof rules).toBe('string');
  });
});
