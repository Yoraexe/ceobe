# Skill: Vitest Unit Testing

## 1. Metadata
- **Name:** `vitest-unit-testing`
- **Origin:** `Astesia Core`
- **Description:** Setup and patterns for writing unit tests using Vitest. Enforces Engineering Directive #16 (Shift-Left TDD) and supports Quality Layer's coverage requirements.

## 2. When to Use
Invoke this skill when:
- Engineering Layer is performing TDD (RED → GREEN → REFACTOR).
- Quality Layer needs to verify or extend unit test coverage.
- Setting up a test infrastructure for a new project.

## 3. Practical Guidance

### Setup
```bash
npm install -D vitest @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80, // Directive #16: 80% minimum
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

### Test Organization
```
src/
├── modules/
│   └── user/
│       ├── user.service.ts
│       ├── user.service.test.ts     # Co-located test
│       ├── user.repository.ts
│       └── user.repository.test.ts
```

**Rule:** Tests are co-located next to the file they test. Name: `{filename}.test.ts`.

### Service Layer Testing (Mock Repository)
```typescript
// src/modules/user/user.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userService } from './user.service';
import { userRepository } from './user.repository';

// Mock the repository layer
vi.mock('./user.repository', () => ({
  userRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const mockUser = { id: 1, name: 'Test', email: 'test@test.com' };
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

      // Act
      const result = await userService.findById(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith(1);
      expect(userRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      await expect(userService.findById(999)).rejects.toThrow('User not found');
    });
  });

  describe('create', () => {
    it('should create user with hashed password', async () => {
      const input = { name: 'New User', email: 'new@test.com', password: 'secure123' };
      const mockCreated = { id: 1, ...input, passwordHash: 'hashed' };
      vi.mocked(userRepository.create).mockResolvedValue(mockCreated);

      const result = await userService.create(input);

      expect(result).toHaveProperty('id');
      expect(userRepository.create).toHaveBeenCalledTimes(1);
      // Verify password is NOT stored in plain text
      const callArg = vi.mocked(userRepository.create).mock.calls[0][0];
      expect(callArg).not.toHaveProperty('password');
    });
  });
});
```

### TDD Workflow (RED → GREEN → REFACTOR)

```bash
# 1. RED: Write failing test first
npx vitest run src/modules/user/user.service.test.ts
# Expected: FAIL

# 2. GREEN: Write minimum implementation to pass
npx vitest run src/modules/user/user.service.test.ts
# Expected: PASS

# 3. REFACTOR: Clean up, then verify no regressions
npx vitest run --coverage
# Expected: PASS with ≥80% coverage
```

### Running Tests
```json
// package.json scripts
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 4. Tested Examples

### Testing Error Cases
```typescript
describe('edge cases', () => {
  it('should handle database connection error gracefully', async () => {
    vi.mocked(userRepository.findAll).mockRejectedValue(new Error('Connection refused'));

    await expect(userService.findAll({ page: 1, limit: 10 }))
      .rejects.toThrow('Connection refused');
  });

  it('should reject duplicate email on create', async () => {
    vi.mocked(userRepository.create).mockRejectedValue(
      new Error('unique_violation: email already exists')
    );

    await expect(userService.create({ name: 'Dup', email: 'existing@test.com', password: '123' }))
      .rejects.toThrow('email already exists');
  });
});
```
