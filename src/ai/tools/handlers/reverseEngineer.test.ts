import { describe, it, expect, vi } from 'vitest';
import { handleReverseEngineer } from './reverseEngineer';

// Mock puppeteer since we don't want to launch real browser in unit tests
vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        on: vi.fn(),
        goto: vi.fn().mockResolvedValue({}),
        title: vi.fn().mockResolvedValue('Mocked Title'),
        close: vi.fn().mockResolvedValue({}),
        evaluate: vi.fn().mockImplementation((fn) => {
          const fnStr = fn.toString();
          if (fnStr.includes('document.querySelectorAll(\'a\')')) {
            return Promise.resolve(['https://example.com/page1']);
          }
          if (fnStr.includes('getComputedStyle')) {
            return Promise.resolve({
              designTokens: { colors: ['#ffffff'], fonts: ['Arial'] },
              layoutStructure: ['div.container -> flex']
            });
          }
          if (fnStr.includes('localStorage')) {
            return Promise.resolve({ localStorage: ['token'], sessionStorage: [] });
          }
          if (fnStr.includes('performance.timing')) {
            return Promise.resolve({ loadTimeMs: 120, domContentLoadedMs: 80 });
          }
          if (fnStr.includes('querySelector(\'meta[name="description"]\')')) {
            return Promise.resolve({
              title: 'Mock Title',
              description: 'Mock Description',
              ogImage: 'mock.png',
              canonicalUrl: 'https://mock.com'
            });
          }
          // Default for framework detectors
          return Promise.resolve(true);
        }),
      }),
      close: vi.fn().mockResolvedValue({}),
    })
  }
}));

describe('Reverse Engineer Handler', () => {
  it('should require url parameter', async () => {
    const res = await handleReverseEngineer({});
    expect(res).toContain('Error: url parameter is required');
  });

  it('should generate a recon report', async () => {
    const res = await handleReverseEngineer({ url: 'example.com' });
    expect(res).toContain('Reverse Engineering Report for https://example.com');
    expect(res).toContain('Title: Mocked Title');
    expect(res).toContain('Next.js'); // Because evaluate returns true for our mock
  });
});
