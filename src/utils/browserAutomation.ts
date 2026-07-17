// Tujuan: Mengotomatisasi peramban Chromium (Headless) untuk mengambil tangkapan layar UI.
// Caller: src/ai/tools/systemTools.ts
// Dependensi: puppeteer, path, fs, utils/context
// Main Functions: captureScreenshot, executeBrowserInteraction
// Side Effects: Launches a headless browser process.

import { getProjectDir } from './context';
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';



export interface ScreenshotResult {
  base64Data: string;
  mediaType: string;
  url: string;
  logs?: string[];
  content?: string;
}

export interface BrowserAction {
  type: 'click' | 'type' | 'wait' | 'press' | 'scroll';
  selector?: string;
  text?: string;
  key?: string;
  ms?: number;
}

export async function captureScreenshot(urlOrPath: string): Promise<ScreenshotResult> {
  return executeBrowserInteraction(urlOrPath, []);
}

export async function executeBrowserInteraction(
  urlOrPath: string,
  actions: BrowserAction[]
): Promise<ScreenshotResult> {
  let targetUrl = urlOrPath;
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    const fullPath = path.resolve(getProjectDir(), urlOrPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    targetUrl = `file:///${fullPath.replace(/\\/g, '/')}`;
  }

  // SSRF Protection
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    const blockedDomains = ['localhost', '127.0.0.1', '169.254.169.254', '0.0.0.0', '::1', 'metadata.google.internal', '100.100.100.200'];
    if (blockedDomains.some(d => targetUrl.includes(d)) || targetUrl.match(/https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
      throw new Error('SSRF Protection: Access to private/local networks is blocked.');
    }
  }

  const browser = await puppeteer.launch({
    headless: true
  });

  const logs: string[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Capture console logs
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(`[error] ${msg}`);
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: 5000 });
              await page.click(action.selector);
            }
            break;
          case 'type':
            if (action.selector && action.text) {
              await page.waitForSelector(action.selector, { timeout: 5000 });
              await page.type(action.selector, action.text);
            }
            break;
          case 'wait':
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: 10000 });
            } else if (action.ms) {
              await new Promise(r => setTimeout(r, action.ms));
            }
            break;
          case 'press':
            if (action.key) {
              await page.keyboard.press(action.key as import('puppeteer').KeyInput);
            }
            break;
          case 'scroll':
            await page.evaluate(() => window.scrollBy(0, 500));
            break;
        }
        // Small wait after each action for transitions
        await new Promise(r => setTimeout(r, 500));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logs.push(`[action-error] Failed ${action.type} on ${action.selector}: ${msg}`);
      }
    }

    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const base64Data = Buffer.from(screenshotBuffer).toString('base64');
    
    // Extract text content for context
    const content = await page.evaluate(() => document.body.innerText.substring(0, 5000));

    return {
      base64Data,
      mediaType: 'image/png',
      url: page.url(),
      logs,
      content
    };
  } finally {
    await browser.close();
  }
}
