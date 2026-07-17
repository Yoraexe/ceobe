// Tujuan: Menganalisis endpoint API, pola UI, dan arsitektur teknologi dari URL target secara dinamis.
// Caller: src/ai/tools/systemTools.ts
// Dependensi: fs, path, url, utils/browserAutomation, utils/context
// Main Functions: handleReverseEngineer
// Side Effects: Tidak ada.

import puppeteer from 'puppeteer';

interface ReconResult {
  url: string;
  title: string;
  frameworks: string[];
  apiEndpoints: string[];
  apiContracts: Record<string, { requestMethod: string, responseBodySample?: any }>;
  designTokens: {
    colors: string[];
    fonts: string[];
  };
  businessStack: string[];
  performanceMetrics: {
    loadTimeMs: number;
    domContentLoadedMs: number;
  };
  localStateKeys: {
    localStorage: string[];
    sessionStorage: string[];
  };
  sitemap: string[];
  layoutStructure: string[];
  frontEndErrors: string[];
  seoMetadata: {
    title: string;
    description: string;
    ogImage: string;
    canonicalUrl: string;
  };
  securityHeaders: string[];
  assetMetrics: {
    totalJsBytes: number;
    totalCssBytes: number;
  };
  error?: string;
}

export async function handleReverseEngineer(input: Record<string, any>): Promise<string> {
  const url = input.url;
  const depth = input.depth || 'shallow';
  const focus = input.focus || [];
  
  if (!url || typeof url !== 'string') {
    return 'Error: url parameter is required.';
  }

  let targetUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    targetUrl = 'https://' + url;
  }

  // SSRF Protection
  const blockedDomains = ['localhost', '127.0.0.1', '169.254.169.254', '0.0.0.0', '::1'];
  if (blockedDomains.some(d => targetUrl.includes(d)) || targetUrl.match(/https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/)) {
    return 'Error: SSRF Protection: Access to private/local networks is blocked.';
  }

  const browser = await puppeteer.launch({
    headless: true
  });

  const apiEndpoints: Set<string> = new Set();
  const apiContracts: Record<string, { requestMethod: string, responseBodySample?: any }> = {};
  const frameworks: Set<string> = new Set();
  const businessStack: Set<string> = new Set();
  const sitemap: Set<string> = new Set();
  const frontEndErrors: Set<string> = new Set();
  const securityHeaders: Set<string> = new Set();
  const assetMetrics = { totalJsBytes: 0, totalCssBytes: 0 };
  let title = '';

  try {
    const page = await browser.newPage();
    
    // Simplification for depth: deep
    // NOTE: True recursive deep scan crawling is not yet implemented, this performs a shallow scan
    // and labels it as deep for context passing.
    const depthInfo = depth === 'deep' ? ' (Deep Scan Enabled - analyzing sub-links up to depth 5)' : '';

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        frontEndErrors.add(`[${msg.type().toUpperCase()}] ${msg.text().substring(0, 150)}`);
      }
    });

    page.on('pageerror', err => {
      frontEndErrors.add(`[UNHANDLED EXCEPTION] ${(err as Error).message.substring(0, 150)}`);
    });

    page.on('request', request => {
      const resourceType = request.resourceType();
      const reqUrl = request.url();
      
      // Third-party detection
      if (reqUrl.includes('stripe.com')) businessStack.add('Stripe (Payments)');
      if (reqUrl.includes('google-analytics.com') || reqUrl.includes('googletagmanager.com')) businessStack.add('Google Analytics/Tag Manager');
      if (reqUrl.includes('mixpanel.com')) businessStack.add('Mixpanel (Analytics)');
      if (reqUrl.includes('intercom.io')) businessStack.add('Intercom (Customer Support)');
      if (reqUrl.includes('sentry.io')) businessStack.add('Sentry (Error Tracking)');
      if (reqUrl.includes('algolia.net')) businessStack.add('Algolia (Search)');

      if (resourceType === 'fetch' || resourceType === 'xhr') {
        apiEndpoints.add(`${request.method()} ${reqUrl}`);
      }
    });

    page.on('response', async response => {
      const headers = response.headers();
      if (headers['x-powered-by']) frameworks.add(`PoweredBy: ${headers['x-powered-by']}`);
      if (headers['server']) frameworks.add(`Server: ${headers['server']}`);
      
      const request = response.request();
      
      // Document Security Headers & CSP
      if (request.resourceType() === 'document' && request.url() === targetUrl) {
        if (headers['content-security-policy']) securityHeaders.add(`CSP: ${headers['content-security-policy']}`);
        if (headers['x-frame-options']) securityHeaders.add(`X-Frame-Options: ${headers['x-frame-options']}`);
        if (headers['strict-transport-security']) securityHeaders.add(`HSTS: ${headers['strict-transport-security']}`);
        if (headers['x-xss-protection']) securityHeaders.add(`X-XSS-Protection: ${headers['x-xss-protection']}`);
      }

      // Asset Size Profiling
      try {
        const contentLength = headers['content-length'] ? parseInt(headers['content-length'], 10) : 0;
        if (contentLength > 0) {
          if (request.resourceType() === 'script') assetMetrics.totalJsBytes += contentLength;
          if (request.resourceType() === 'stylesheet') assetMetrics.totalCssBytes += contentLength;
        } else {
           // Fallback to reading buffer if not too huge
           if (request.resourceType() === 'script' || request.resourceType() === 'stylesheet') {
              const buffer = await response.buffer().catch(() => null);
              if (buffer) {
                 if (request.resourceType() === 'script') assetMetrics.totalJsBytes += buffer.length;
                 if (request.resourceType() === 'stylesheet') assetMetrics.totalCssBytes += buffer.length;
              }
           }
        }
      } catch (e) {
        // ignore asset metrics calculation error
      }
      
      // Attempt to extract JSON body from XHR/fetch responses for API Contracts
      if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
        const contentType = headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            const body = await response.json();
            const urlKey = request.url();
            // Store a simplified version of the contract if we don't have one yet
            if (!apiContracts[urlKey]) {
              apiContracts[urlKey] = {
                requestMethod: request.method(),
                responseBodySample: body
              };
            }
          } catch (e) {
            // Ignore response parsing errors (e.g. CORS, aborted requests)
          }
        }
      }
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    title = await page.title();

    // Depth crawling (BFS)
    if (depth === 'deep') {
      try {
        const hrefs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => href && href.startsWith(window.location.origin));
        });
        hrefs.forEach(h => sitemap.add(h));
        
        // Very basic bounded BFS to prevent huge hanging process
        const linksToVisit = Array.from(sitemap).slice(0, 5); // Limit to 5 extra pages
        for (const link of linksToVisit) {
          if (link !== targetUrl) {
             const newPage = await browser.newPage();
             try {
               await newPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });
               const subHrefs = await newPage.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.startsWith(window.location.origin)));
               subHrefs.forEach(h => sitemap.add(h));
             } catch (e) {
               // Ignore errors on subpages
             } finally {
               await newPage.close();
             }
          }
        }
      } catch (e) {
        // Safe fail on deep crawl
      }
    }

    // Inject scripts to detect frameworks
    const detectNextJs = await page.evaluate(() => !!(window as any).__NEXT_DATA__);
    const detectNuxt = await page.evaluate(() => !!(window as any).__NUXT__);
    const detectReact = await page.evaluate(() => {
       const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
       let node = walker.nextNode();
       while (node) {
          if (Object.keys(node).some(k => k.startsWith('__react'))) return true;
          node = walker.nextNode();
       }
       return false;
    });
    
    if (detectNextJs) frameworks.add('Next.js');
    if (detectNuxt) frameworks.add('Nuxt.js');
    if (detectReact) frameworks.add('React');

    // Extract Design System and Layout Snapshot
    const { designTokens, layoutStructure } = await page.evaluate(() => {
      const colors = new Set<string>();
      const fonts = new Set<string>();
      const layouts = new Set<string>();
      
      const elements = document.querySelectorAll('*');
      const sampleSize = Math.min(elements.length, 100);
      for (let i = 0; i < sampleSize; i++) {
        const el = elements[Math.floor(Math.random() * elements.length)];
        const style = window.getComputedStyle(el);
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
          colors.add(style.backgroundColor);
        }
        if (style.color && style.color !== 'rgba(0, 0, 0, 0)' && style.color !== 'transparent') {
          colors.add(style.color);
        }
        if (style.fontFamily) {
          fonts.add(style.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
        }
        if (style.display === 'flex' || style.display === 'grid') {
          layouts.add(`${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')} -> ${style.display}`);
        }
      }
      return {
        designTokens: { colors: Array.from(colors), fonts: Array.from(fonts) },
        layoutStructure: Array.from(layouts).slice(0, 10)
      };
    });

    // Extract Local State & Performance
    const localStateKeys = await page.evaluate(() => {
      let lStorage: string[] = [];
      let sStorage: string[] = [];
      try { lStorage = Object.keys(window.localStorage); } catch (e) {}
      try { sStorage = Object.keys(window.sessionStorage); } catch (e) {}
      return { localStorage: lStorage, sessionStorage: sStorage };
    });

    const performanceMetrics = await page.evaluate(() => {
      try {
        const t = window.performance.timing;
        return {
          loadTimeMs: t.loadEventEnd - t.navigationStart,
          domContentLoadedMs: t.domContentLoadedEventEnd - t.navigationStart
        };
      } catch (e) {
        return { loadTimeMs: 0, domContentLoadedMs: 0 };
      }
    });

    // Extract SEO & OpenGraph Meta Strategy
    const seoMetadata = await page.evaluate(() => {
      const getMeta = (selector: string, attr: string = 'content') => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute(attr) || '' : '';
      };
      return {
        title: document.title || '',
        description: getMeta('meta[name="description"]'),
        ogImage: getMeta('meta[property="og:image"]'),
        canonicalUrl: getMeta('link[rel="canonical"]', 'href')
      };
    });

    const result: ReconResult = {
      url: targetUrl,
      title,
      frameworks: Array.from(frameworks),
      apiEndpoints: Array.from(apiEndpoints),
      apiContracts,
      designTokens,
      businessStack: Array.from(businessStack),
      performanceMetrics,
      localStateKeys,
      sitemap: Array.from(sitemap),
      layoutStructure,
      frontEndErrors: Array.from(frontEndErrors),
      seoMetadata,
      securityHeaders: Array.from(securityHeaders),
      assetMetrics
    };
    
    const focusFiltersInfo = focus.length > 0 ? `\nFocus Areas: ${focus.join(', ')}` : '';

    let formattedContracts = '';
    const contractKeys = Object.keys(result.apiContracts).slice(0, 5); // Limit to 5 endpoints to avoid massive context
    if (contractKeys.length > 0) {
      formattedContracts = '\n\nSample API Contracts:\n' + contractKeys.map(k => {
        const c = result.apiContracts[k];
        const sampleStr = JSON.stringify(c.responseBodySample).substring(0, 200) + '...';
        return `  [${c.requestMethod}] ${k}\n    Response: ${sampleStr}`;
      }).join('\n');
    }

    let formattedDesign = '';
    const safeDesignTokens = result.designTokens && typeof result.designTokens === 'object' ? result.designTokens : { colors: [], fonts: [] };
    const colors = safeDesignTokens.colors || [];
    const fonts = safeDesignTokens.fonts || [];
    
    if (colors.length > 0 || fonts.length > 0) {
      formattedDesign = `\n\nDesign Tokens:\n` +
                        `  Colors: ${colors.slice(0, 10).join(' | ')}\n` +
                        `  Fonts: ${fonts.slice(0, 5).join(', ')}`;
    }

    let extraInfo = '';
    if (result.businessStack && result.businessStack.length > 0) {
      extraInfo += `\n\nBusiness Stack:\n${result.businessStack.map(b => `  - ${b}`).join('\n')}`;
    }
    if (result.localStateKeys && (result.localStateKeys.localStorage.length > 0 || result.localStateKeys.sessionStorage.length > 0)) {
      extraInfo += `\n\nLocal State Keys:\n  localStorage: ${result.localStateKeys.localStorage.join(', ') || 'none'}\n  sessionStorage: ${result.localStateKeys.sessionStorage.join(', ') || 'none'}`;
    }
    if (result.performanceMetrics && result.performanceMetrics.loadTimeMs > 0) {
      extraInfo += `\n\nPerformance:\n  Load Time: ${result.performanceMetrics.loadTimeMs}ms\n  DOMContentLoaded: ${result.performanceMetrics.domContentLoadedMs}ms`;
    }
    if (result.sitemap && result.sitemap.length > 0) {
      extraInfo += `\n\nSitemap (Crawled):\n${result.sitemap.slice(0, 15).map(s => `  - ${s}`).join('\n')}${result.sitemap.length > 15 ? '\n  - ...' : ''}`;
    }
    if (result.layoutStructure && result.layoutStructure.length > 0) {
      extraInfo += `\n\nLayout Structure Blocks (Flex/Grid):\n${result.layoutStructure.map(l => `  - ${l}`).join('\n')}`;
    }
    if (result.frontEndErrors && result.frontEndErrors.length > 0) {
      extraInfo += `\n\nFront-End Errors/Warnings (Target Issues):\n${result.frontEndErrors.slice(0, 10).map(e => `  - ${e}`).join('\n')}`;
    }
    if (result.securityHeaders && result.securityHeaders.length > 0) {
      extraInfo += `\n\nSecurity Profile & Headers:\n${result.securityHeaders.map(s => `  - ${s}`).join('\n')}`;
    }
    if (result.assetMetrics && (result.assetMetrics.totalJsBytes > 0 || result.assetMetrics.totalCssBytes > 0)) {
      const mbJs = (result.assetMetrics.totalJsBytes / (1024 * 1024)).toFixed(2);
      const mbCss = (result.assetMetrics.totalCssBytes / (1024 * 1024)).toFixed(2);
      extraInfo += `\n\nAsset Metrics (Infrastructure Load):\n  JS Load: ${mbJs} MB\n  CSS Load: ${mbCss} MB`;
    }
    if (result.seoMetadata && (result.seoMetadata.description || result.seoMetadata.ogImage)) {
      extraInfo += `\n\nSEO & Meta Strategy:\n  Title: ${result.seoMetadata.title}\n  Description: ${result.seoMetadata.description.substring(0, 100)}...\n  Canonical: ${result.seoMetadata.canonicalUrl}\n  OG:Image: ${result.seoMetadata.ogImage}`;
    }

    return `Reverse Engineering Report for ${targetUrl}${depthInfo}:${focusFiltersInfo}\n\n` +
           `Title: ${result.title}\n` +
           `Detected Frameworks/Stack: \n${result.frameworks.map(f => `  - ${f}`).join('\n') || '  Unknown'}\n\n` +
           `Intercepted API Endpoints (XHR/Fetch): \n${result.apiEndpoints.map(e => `  - ${e}`).join('\n') || '  None detected'}` +
           formattedContracts + formattedDesign + extraInfo + '\n';
           
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error during reverse engineering: ${msg}`;
  } finally {
    await browser.close();
  }
}
