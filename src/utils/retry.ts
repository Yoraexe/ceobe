import chalk from 'chalk';
import { log } from './context';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

// Sanitizer to mask API keys from leaking into logs
function sanitizeError(msg: string): string {
  if (!msg) return msg;
  return msg.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer ***')
            .replace(/sk-[a-zA-Z0-9_-]{20,}/gi, 'sk-***');
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.initialDelayMs ?? 1000;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;
      
      let msg = error instanceof Error ? error.message : String(error);
      msg = sanitizeError(msg);
      
      const errObj = error as Record<string, unknown>;
      const resp = errObj?.response as Record<string, unknown> | undefined;
      const status = (errObj?.status ?? resp?.status ?? errObj?.statusCode) as number | undefined;
      
      // Sanitized Error
      const sanitizedError = error instanceof Error ? error : new Error(msg);
      if (error instanceof Error) {
        sanitizedError.message = msg;
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
