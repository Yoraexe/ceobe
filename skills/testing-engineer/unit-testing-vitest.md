# Unit Testing with Vitest (Testing Engineer)

## 1. Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,           // Use describe/it/expect without imports
    environment: 'node',     // or 'jsdom' for browser-like tests
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
      }
    },
    testTimeout: 10000,      // 10s timeout per test
  },
});
```

## 2. Testing Async Functions
```typescript
import { describe, it, expect } from 'vitest';
import { fetchData } from './api';

describe('fetchData', () => {
  it('should resolve with data', async () => {
    const data = await fetchData('/users');
    expect(data).toHaveLength(3);
  });

  it('should throw on 404', async () => {
    await expect(fetchData('/not-found')).rejects.toThrow('Not Found');
  });
});
```

## 3. Snapshot Testing
```typescript
it('should match config snapshot', () => {
  const config = generateConfig({ env: 'production' });
  expect(config).toMatchSnapshot();
});
```

## 4. Parameterized Tests (test.each)
```typescript
it.each([
  { input: 0, expected: 'zero' },
  { input: 1, expected: 'one' },
  { input: 2, expected: 'two' },
])('numberToWord($input) should return "$expected"', ({ input, expected }) => {
  expect(numberToWord(input)).toBe(expected);
});
```