import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('retry utility', () => {
  it('should return result if operation succeeds immediately', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry and eventually succeed', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
    
    // Use small delay for testing
    const result = await withRetry(operation, { initialDelayMs: 1 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('constant fail'));
    
    await expect(withRetry(operation, { maxRetries: 2, initialDelayMs: 1 }))
      .rejects.toThrow('constant fail');
    
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
