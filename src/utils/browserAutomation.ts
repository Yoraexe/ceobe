// Tujuan: Mengotomatisasi peramban Chromium (Headless) untuk mengambil tangkapan layar UI.
// Caller: src/ai/tools/systemTools.ts
// Dependensi: puppeteer, path, fs
// Main Functions: captureScreenshot
// Side Effects: Launches a headless browser process.

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '../config/env';

export interface ScreenshotResult {
  base64Data: string;
  mediaType: string;
  url: string;
}

export async function captureScreenshot(urlOrPath: string): Promise<ScreenshotResult> {
  // Determine if it's a URL or a local file path
  let targetUrl = urlOrPath;
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    // If it's a local path, ensure it exists and convert to file:// URL
    const fullPath = path.resolve(env.TARGET_PROJECT_DIR, urlOrPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    targetUrl = `file:///${fullPath.replace(/\\/g, '/')}`;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some environments
  });

  try {
    const page = await browser.newPage();
    // Set standard desktop viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const base64Data = Buffer.from(screenshotBuffer).toString('base64');
    
    return {
      base64Data,
      mediaType: 'image/png',
      url: targetUrl
    };
  } finally {
    await browser.close();
  }
}
