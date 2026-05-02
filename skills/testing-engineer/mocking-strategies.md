# Mocking Strategies (Testing Engineer)

## 1. Module-Level Mocking (Vitest)
Replace an entire module with a mock implementation:

```typescript
import { vi } from 'vitest';

// Mock the entire database module
vi.mock('./database', () => ({
  getUserById: vi.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
  createUser: vi.fn().mockResolvedValue({ id: 2, name: 'Bob' }),
}));
```

## 2. Spy-Based Mocking
When you want to observe calls without replacing the implementation:

```typescript
import * as utils from './utils';

const spy = vi.spyOn(utils, 'formatDate');
spy.mockReturnValue('2024-01-01');

// After test:
expect(spy).toHaveBeenCalledTimes(1);
spy.mockRestore(); // Restore original implementation
```

## 3. Mocking HTTP Requests (MSW Pattern)
For integration tests, use Mock Service Worker instead of mocking `fetch` directly:

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## 4. Mocking Timers
For code that depends on `Date.now()`, `setTimeout`, or `setInterval`:

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('should format today correctly', () => {
  expect(formatToday()).toBe('January 1, 2024');
});
```

## 5. Mocking Environment Variables
```typescript
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost/testdb');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```