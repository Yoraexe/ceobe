import chalk from 'chalk';
import { log } from './context';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
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
      
      const msg = error instanceof Error ? error.message : String(error);
      const errObj = error as Record<string, unknown>;
      const resp = errObj?.response as Record<string, unknown> | undefined;
      const status = (errObj?.status ?? resp?.status ?? errObj?.statusCode) as number | undefined;
      
      // Abort early if it's a 4xx error (except 429 Rate Limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      if (/\b(?:400|401|403|404)\b/.test(msg)) {
        throw error;
      }

      if (attempt >= maxRetries) {
        throw error;
      }
      
      log(chalk.yellow(`\n[Retry] Operation failed (${msg}). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`));
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
