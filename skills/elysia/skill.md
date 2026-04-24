# Skill: Elysia REST API Design

## 1. Metadata
- **Name:** `elysia-rest-api`
- **Origin:** `Astesia Core`
- **Description:** Patterns for building ultra-fast REST APIs with Elysia.js on the Bun runtime. Covers Eden (end-to-end type safety), plugins, and TypeBox validation.

## 2. When to Use
Invoke this skill when:
- The Engineering Layer decides on Elysia (Bun) as the backend framework.
- High performance and end-to-end type safety with a TypeScript frontend (like SvelteKit) is required.

## 3. Practical Guidance

### Project Structure (Modular by Domain)
```
src/
├── index.ts                    # Main entrypoint
├── setup.ts                    # Global plugins (cors, swagger, db injection)
├── modules/
│   ├── user/
│   │   ├── user.controller.ts  # Elysia plugin for user routes
│   │   ├── user.model.ts       # TypeBox schemas (Elysia's default)
│   │   ├── user.service.ts
│   │   └── user.repository.ts
│   └── auth/
└── db/
```

### Elysia Plugin Pattern (Controller)
Elysia is inherently plugin-based. Every module is a plugin.

```typescript
// src/modules/user/user.controller.ts
import { Elysia, t } from 'elysia';
import { userService } from './user.service';
import { UserDTO, CreateUserDTO } from './user.model';

export const userController = new Elysia({ prefix: '/users' })
  .get('/', async () => {
    return await userService.findAll();
  }, {
    response: t.Array(UserDTO),
    detail: { summary: 'Get all users' }
  })
  .get('/:id', async ({ params: { id } }) => {
    return await userService.findById(id);
  }, {
    params: t.Object({ id: t.Numeric() }),
    response: UserDTO
  })
  .post('/', async ({ body }) => {
    return await userService.create(body);
  }, {
    body: CreateUserDTO,
    response: UserDTO
  });
```

### Main Entrypoint & Eden Export
```typescript
// src/index.ts
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { userController } from './modules/user/user.controller';

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(userController)
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

// Export type for Eden (Frontend consumer)
export type App = typeof app;
```

### End-to-End Type Safety (Frontend Consumer)
If the frontend is a TypeScript app in a monorepo, use Eden to consume the API with perfect type safety.

```typescript
// Frontend code (e.g., in SvelteKit +page.server.ts)
import { treaty } from '@elysiajs/eden';
import type { App } from '../../backend/src/index';

const api = treaty<App>('localhost:3000');

// Fully typed! Autocomplete works for routes, body, and response.
const { data, error } = await api.users.index.get();
const { data: newUser } = await api.users.index.post({
  name: 'John',
  email: 'john@example.com'
});
```

## 4. Tested Examples
(See above for the controller structure and Eden usage)
