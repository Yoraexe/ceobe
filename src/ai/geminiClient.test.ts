import { describe, it, expect } from 'vitest';
import { getGeminiClient } from './geminiClient';
import { GoogleGenAI } from '@google/genai';

describe('geminiClient', () => {
  it('should return a GoogleGenAI instance', () => {
    const client = getGeminiClient();
    expect(client).toBeInstanceOf(GoogleGenAI);
  });

  it('should return the same singleton instance', () => {
    const client1 = getGeminiClient();
    const client2 = getGeminiClient();
    expect(client1).toBe(client2);
  });
});
