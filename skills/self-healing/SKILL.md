# Skill: Self-Healing & Autonomic Debugging

## 1. Metadata
- **Name:** `self-healing`
- **Origin:** `Astesia Core`
- **Description:** The cognitive loop for autonomic debugging and error resolution. Provides concrete patterns for retry logic, circuit breakers, graceful degradation, and structured error diagnosis.

## 2. When to Use
Invoke this skill when:
- Building services that must stay operational under partial failure.
- Integrating with external APIs or unreliable third-party services.
- The BRD mentions "resilience," "fault tolerance," or "99.9% uptime."

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never swallow errors silently (`catch (e) { /* nothing */ }`).
- ❌ Never retry indefinitely without a backoff strategy.
- ❌ Never let a single failing dependency take down the entire system.
- ❌ Never return HTTP 200 for an error — always use correct status codes.

## 4. Practical Patterns

### Retry with Exponential Backoff
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
  throw lastError!;
}

// Usage:
const data = await withRetry(() => fetchFromExternalAPI(url), 3, 2000);
```

### Circuit Breaker
```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN — service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailure = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}

// Usage:
const paymentCircuit = new CircuitBreaker(5, 60000);
const result = await paymentCircuit.execute(() => chargeCustomer(amount));
```

### Graceful Degradation
```typescript
// If a non-critical service fails, return cached/fallback data instead of erroring
async function getUserProfile(id: string) {
  try {
    const profile = await profileService.getById(id);
    await cache.set(`profile:${id}`, profile);
    return profile;
  } catch (err) {
    console.warn('Profile service degraded, serving cached version');
    const cached = await cache.get(`profile:${id}`);
    if (cached) return cached;
    throw err; // Only throw if no fallback available
  }
}
```

### Structured Error Diagnosis (For Ceobe's Self-Healing Loop)
When Ceobe encounters an error during execution, follow this protocol:
1. **Read the full error message** — do not guess.
2. **Identify the error type:** Compilation, Runtime, Test, or Timeout.
3. **Isolate the failing file** — use the stack trace or file path.
4. **Read the specific file** — use `read_file` on only the failing file.
5. **Apply the minimal fix** — use `edit_file`, not `write_file`.
6. **Re-verify** — the Supervisor will re-run verification automatically.

## 5. Resilience Checklist
- [ ] All external API calls wrapped in retry with backoff
- [ ] Circuit breaker on critical dependencies (payment, auth providers)
- [ ] Fallback/cached responses for non-critical service failures
- [ ] Health check endpoint reports dependency status
- [ ] Structured logging for all errors (not just `console.error`)
- [ ] Graceful shutdown handler (drain connections, finish in-flight requests)