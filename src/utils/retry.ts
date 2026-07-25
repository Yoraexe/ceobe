// Tujuan: Menyediakan fungsi pembungkus retry (withRetry) dengan pola exponential backoff dan sensor kebocoran kunci API.
// Caller: Provider adapters (anthropic, gemini, dll.)
// Dependensi: chalk, utils/context
// Main Functions: withRetry, sanitizeError
// Side Effects: Tidak ada.

import chalk from 'chalk';
import { log } from './context';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
}

// Sanitizer to mask API keys from leaking into logs
function sanitizeError(msg: string): string {
  if (!msg) return msg;
  return msg.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer ***')
            .replace(/sk-(ant|proj)?-[a-zA-Z0-9_-]{20,}/gi, 'sk-***')
            .replace(/AIza[Sy][a-zA-Z0-9_\-]{33}/g, 'AIza***')
            .replace(/(?:key|api_key|secret|token)=["']?[a-zA-Z0-9_\-]{16,}["']?/gi, 'api_key=***')
            .replace(/x-api-key:\s*[a-zA-Z0-9_\-]{16,}/gi, 'x-api-key: ***')
            .replace(/key-[a-zA-Z0-9]{20,}/gi, 'key-***');
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 120000; // Default 120s timeout
  let delay = options.initialDelayMs ?? 1000;
  let attempt = 0;

  while (true) {
    try {
      // Execute operation with timeout
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      try {
        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      attempt++;
      
      let msg = error instanceof Error ? error.message : String(error);
      msg = sanitizeError(msg);
      
      const errObj = error as Record<string, unknown>;
      const resp = errObj?.response as Record<string, unknown> | undefined;
      const status = (errObj?.status ?? resp?.status ?? errObj?.statusCode) as number | undefined;
      
      // Sanitized Error
      const sanitizedError = new Error(msg);
      if (error instanceof Error && error.stack) {
        sanitizedError.stack = error.stack;
      }
      
      // Abort early if it's a 4xx error (except 429 Rate Limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw sanitizedError;
      }

      if (attempt >= maxRetries) {
        throw sanitizedError;
      }
      
      log(chalk.yellow(`\n[Retry] Operation failed (${msg}). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`));
      await new Promise(resolve => setTimeout(resolve, delay));
      const jitter = Math.random() * 500;
      delay = Math.min(delay * 2 + jitter, 60000); // Exponential backoff with jitter and 60s cap
    }
  }
}
