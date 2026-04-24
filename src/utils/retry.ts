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
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      
      console.log(chalk.yellow(`\n[Retry] Operation failed (${error.message}). Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries - 1})`));
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}
