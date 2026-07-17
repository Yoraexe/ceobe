import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { captureScreenshot, executeBrowserInteraction } from './browserAutomation';
const mocks = vi.hoisted(() => {
  const page = {
    setViewport: vi.fn(),
    goto: vi.fn(),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    on: vi.fn(),
    evaluate: vi.fn().mockResolvedValue('mock-content'),
    waitForSelector: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    keyboard: { press: vi.fn() },
    url: vi.fn().mockReturnValue('http://mock-url.com'),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn(),
  };
  return { page, browser };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: vi.fn().mockResolvedValue(mocks.browser),
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
    const result = await captureScreenshot('http://example.com');
    expect(mocks.page.goto).toHaveBeenCalledWith('http://example.com', expect.any(Object));
    expect(mocks.page.screenshot).toHaveBeenCalled();
    expect(mocks.browser.close).toHaveBeenCalled();
    expect(result.mediaType).toBe('image/png');
  });

  it('should execute interactions', async () => {
    const result = await executeBrowserInteraction('http://test.com', [
      { type: 'click', selector: '#btn' },
      { type: 'type', selector: '#input', text: 'hello' }
    ]);
    expect(mocks.page.click).toHaveBeenCalledWith('#btn');
    expect(mocks.page.type).toHaveBeenCalledWith('#input', 'hello');
    expect(result.content).toBe('mock-content');
  });

  it('should throw error if local file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(captureScreenshot('missing.html')).rejects.toThrow('File not found');
  });
});
