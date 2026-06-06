import { describe, it, expect } from 'vitest';
import { extractTypeScriptSignatures, isTypeScriptFile } from './astParser';

describe('astParser', () => {
  describe('isTypeScriptFile', () => {
    it('should return true for ts files', () => {
      expect(isTypeScriptFile('index.ts')).toBe(true);
      expect(isTypeScriptFile('App.tsx')).toBe(true);
    });

    it('should return false for non-ts files', () => {
      expect(isTypeScriptFile('style.css')).toBe(false);
      expect(isTypeScriptFile('README.md')).toBe(false);
    });
  });

  describe('extractTypeScriptSignatures', () => {
    it('should extract signatures correctly', () => {
      const code = `
class MyClass {
  constructor() {}
  public hello() {}
}

export function helloWorld() {
  console.log("hello");
}
      `;

      const sigs = extractTypeScriptSignatures(code, 'test.ts');
      
      expect(sigs).toContain('class MyClass');
      expect(sigs).toContain('helloWorld');
    });

    it('should handle interfaces', () => {
      const code = `
export interface User {
  id: number;
}
      `;
      const sigs = extractTypeScriptSignatures(code, 'test.ts');
      expect(sigs).toContain('interface User');
    });
  });
});
