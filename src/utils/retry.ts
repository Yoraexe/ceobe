import chalk from 'chalk';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  let delay = options.initialDelayMs || 1000;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;
      
      const msg = error instanceof Error ? error.message : String(error);
      const anyErr = error as any;
      const status = anyErr?.status || anyErr?.response?.status || anyErr?.statusCode;
      
      // Abort early if it's a 4xx error (except 429 Rate Limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }
      if (msg.includes('400') || msg.includes('401') || msg.includes('403') || msg.includes('404')) {
        throw error;
      }

      if (attempt >= maxRetries) {
        throw error;
      }
      
      console.log(chalk.yellow(`\n[Retry] Operation failed (${msg}). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries - 1})`));
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
