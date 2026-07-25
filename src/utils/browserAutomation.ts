// Tujuan: Mengotomatisasi peramban Chromium (Headless) untuk mengambil tangkapan layar UI, dilengkapi dengan DNS SSRF protection.
// Caller: src/ai/tools/systemTools.ts
// Dependensi: puppeteer, path, fs, dns, url, utils/context
// Main Functions: captureScreenshot, executeBrowserInteraction
// Side Effects: Launches a headless browser process.

import { getProjectDir } from './context';
import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { promises as dns } from 'dns';
import { URL } from 'url';

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

function isPrivateIP(ipStr: string): boolean {
  const ip = ipStr.trim().toLowerCase();

  if (['localhost', 'metadata.google.internal', '100.100.100.200', '0.0.0.0', '0'].includes(ip)) {
    return true;
  }

  // IPv6 check
  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return true;
    }
  }

  // Hex or octal or integer representation
  if (/^0x[0-9a-f]+$/i.test(ip) || /^[0-9]+$/.test(ip) || /^0[0-7]+(\.0[0-7]+)*$/.test(ip)) {
    return true;
  }

  // standard dotted IPv4
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    const [a, b] = parts;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

export async function executeBrowserInteraction(
  urlOrPath: string,
  actions: BrowserAction[]
): Promise<ScreenshotResult> {
  let targetUrl = urlOrPath;
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    const cleanPath = urlOrPath.replace(/^file:\/\/\/?/i, '');
    const fullPath = path.resolve(getProjectDir(), cleanPath);
    const relative = path.relative(getProjectDir(), fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('SSRF / Path Traversal Protection: Access outside project directory is blocked.');
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    targetUrl = `file:///${fullPath.replace(/\\/g, '/')}`;
  }

  // SSRF Protection
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(targetUrl);
      const hostname = parsedUrl.hostname;
      
      const ips: string[] = [];
      try {
        const addresses = await dns.lookup(hostname, { all: true });
        addresses.forEach(a => ips.push(a.address));
      } catch (dnsErr) {
        // DNS failed or unresolved
      }
      ips.push(hostname);

      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          throw new Error('SSRF Protection: Access to private/local networks is blocked.');
        }
      }
    } catch (err: any) {
      if (err.message.includes('SSRF Protection')) {
        throw err;
      }
      throw new Error(`SSRF Protection: Invalid URL. ${err.message}`);
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
              const safeMs = Math.min(Math.max(0, action.ms), 30000);
              await new Promise(r => setTimeout(r, safeMs));
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
