import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiAdapter } from './geminiAdapter';

vi.mock('@google/genai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'mock gemini response' }
      })
    })
  }))
}));
vi.mock('../../config/env', () => ({
  env: { GEMINI_API_KEY: 'test-key' },
  getGatewayUrl: vi.fn().mockReturnValue('')
}));

describe('GeminiAdapter', () => {
  it('should instantiate and generate content', async () => {
    const adapter = new GeminiAdapter('gemini-mock');
    const result = await adapter.generate('hello');
    expect(result).toBe('mock gemini response');
  });

  it('should support chat as a fallback to generate', async () => {
    const adapter = new GeminiAdapter('gemini-mock');
    const response = await adapter.chat([{ role: 'user', content: 'hi' }], [], 'instruction');
    expect(response.content[0].text).toBe('mock gemini response');
    expect(response.stop_reason).toBe('end_turn');
  });
});
