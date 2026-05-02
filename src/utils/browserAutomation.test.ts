import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { captureScreenshot } from './browserAutomation';

// Mock puppeteer
export const mockPage = {
  setViewport: vi.fn(),
  goto: vi.fn(),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-image-data')),
};
export const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};

vi.mock('puppeteer', () => ({
  default: {
    launch: (...args: any[]) => vi.fn().mockResolvedValue(mockBrowser)(...args),
  },
}));

vi.mock('fs');
vi.mock('../config/env', () => ({
  env: { TARGET_PROJECT_DIR: '/mock/workspace' }
}));

describe('browserAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should capture screenshot for URL', async () => {
    const result = await captureScreenshot('http://localhost:3000');
    expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', expect.any(Object));
    expect(mockPage.screenshot).toHaveBeenCalled();
    expect(mockBrowser.close).toHaveBeenCalled();
    expect(result.mediaType).toBe('image/png');
    expect(result.base64Data).toBe(Buffer.from('mock-image-data').toString('base64'));
  });

  it('should throw error if local file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(captureScreenshot('missing.html')).rejects.toThrow('File not found');
  });

  it('should capture screenshot for local file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const result = await captureScreenshot('test.html');
    expect(mockPage.goto).toHaveBeenCalled();
    expect(result.mediaType).toBe('image/png');
  });
});
