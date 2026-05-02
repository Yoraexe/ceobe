---
name: testing-engineer
description: Best practices for writing robust, deterministic Unit, Integration, and E2E tests.
---
# TESTING ENGINEER SKILL

## 1. Core Philosophy
You break code before it reaches production. Write tests that run fast, never flake, and provide absolute confidence. A test that fails randomly is worse than no test at all.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `setTimeout` or sleep functions to wait for UI updates. Use proper async waiting (`await waitFor()`).
- ❌ Never couple tests tightly to implementation details (e.g., testing private methods or specific DOM structures). Test behavior and public APIs.
- ❌ Never leave mocked network requests hanging. Always mock or intercept external API calls in unit tests.
- ❌ Never let state leak between tests. Always use `beforeEach` to reset mocks and databases.

## 3. Practical Patterns

### 3.1 The AAA Pattern (Arrange, Act, Assert)
Always structure your tests visually using the AAA pattern.

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './pricing';

describe('calculateDiscount', () => {
  it('should apply a 10% discount for gold members', () => {
    // 1. Arrange
    const user = { role: 'gold' };
    const cartTotal = 100;

    // 2. Act
    const result = calculateDiscount(cartTotal, user);

    // 3. Assert
    expect(result).toBe(90);
  });
});
```

### 3.2 Mocking External Dependencies (Vitest)
Isolate the unit under test by mocking modules like `fs`, APIs, or databases.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUserProfile } from './api';
import * as db from './database';

// Mock the entire database module
vi.mock('./database');

describe('fetchUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Critical: Reset state before each test
  });

  it('should return user data if found in db', async () => {
    // Arrange
    vi.spyOn(db, 'getUserById').mockResolvedValue({ id: 1, name: 'Alice' });

    // Act
    const result = await fetchUserProfile(1);

    // Assert
    expect(db.getUserById).toHaveBeenCalledWith(1);
    expect(result.name).toBe('Alice');
  });
});
```

### 3.3 Integration Testing Patterns (Database)
When testing against a real database (e.g., using testcontainers or an in-memory SQLite):

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from './db/client';
import { users } from './db/schema';
import { createUser } from './userService';

describe('UserService Integration', () => {
  beforeAll(async () => {
    await db.migrate(); // Run schema creation
  });

  afterAll(async () => {
    await db.close(); // Clean up connections
  });

  beforeEach(async () => {
    // Truncate tables to ensure a clean slate
    await db.delete(users);
  });

  it('should persist a new user to the database', async () => {
    await createUser({ email: 'test@example.com', name: 'Bob' });
    const savedUser = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, 'test@example.com') });
    
    expect(savedUser).toBeDefined();
    expect(savedUser?.name).toBe('Bob');
  });
});
```

### 3.4 Flaky Test Prevention
- Use deterministic dates: `vi.setSystemTime(new Date('2024-01-01'))`
- Use deterministic random numbers if logic depends on `Math.random()`.