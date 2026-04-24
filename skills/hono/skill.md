# Skill: Backend REST API Design (Hono)

## 1. Metadata
- **Name:** `hono-rest-api`
- **Origin:** `Astesia Core`
- **Description:** Patterns for building REST APIs with the Hono framework. Covers route design, middleware, error handling, and structured responses. Enforces Directives #1, #3, #4, #7.

## 2. When to Use
Invoke this skill when:
- Building a new backend API using Hono (Astesia default HTTP framework).
- Adding new endpoints to an existing Hono application.
- Setting up middleware chains (auth, validation, logging, CORS).

## 3. Practical Guidance

### Route Design Principles
1. **Predictable Routes:** Use plurals (`GET /users` instead of `/getUser`).
2. **Explicit Returns:** Always return structured JSON:
   ```json
   { "success": true, "data": {}, "error": null }
   { "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "User not found" } }
   ```
3. **Status Codes:** 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity), 500 (Internal Server Error).

### Project Structure (Modular by Domain)
```
src/
├── index.ts                    # Entrypoint — creates Hono app, mounts routes
├── middleware/                  # Shared middleware
│   ├── auth.middleware.ts       # JWT verification
│   ├── error.middleware.ts      # Global error handler
│   └── logger.middleware.ts     # Request logging (Pino)
├── modules/                    # Feature modules (Directive #6)
│   ├── user/
│   │   ├── user.routes.ts      # Route definitions (Thin Controller)
│   │   ├── user.schema.ts      # Zod schemas
│   │   ├── user.service.ts     # Business logic
│   │   ├── user.repository.ts  # Data access
│   │   └── user.service.test.ts
│   └── auth/
│       ├── auth.routes.ts
│       ├── auth.schema.ts
│       ├── auth.service.ts
│       └── auth.service.test.ts
└── db/
    ├── schema.ts               # Drizzle schema
    └── connection.ts           # DB connection pool
```

### Entrypoint Pattern
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { userRoutes } from './modules/user/user.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { errorHandler } from './middleware/error.middleware';

const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', logger());
app.onError(errorHandler);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount domain routes
app.route('/auth', authRoutes);
app.route('/users', userRoutes);

export default {
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
};
```

### Thin Controller Pattern (Directive #3)
```typescript
// src/modules/user/user.routes.ts
import { Hono } from 'hono';
import { createUserSchema, paginationSchema, idParamSchema } from './user.schema';
import { userService } from './user.service';
import { authMiddleware } from '../../middleware/auth.middleware';

export const userRoutes = new Hono();

// GET /users — List users (paginated)
userRoutes.get('/', authMiddleware, async (c) => {
  const query = paginationSchema.parse(c.req.query());
  const users = await userService.findAll(query);
  return c.json({ success: true, data: users });
});

// GET /users/:id — Get single user
userRoutes.get('/:id', authMiddleware, async (c) => {
  const { id } = idParamSchema.parse({ id: c.req.param('id') });
  const user = await userService.findById(id);
  return c.json({ success: true, data: user });
});

// POST /users — Create user
userRoutes.post('/', authMiddleware, async (c) => {
  const body = await c.req.json();
  const data = createUserSchema.parse(body);
  const user = await userService.create(data);
  return c.json({ success: true, data: user }, 201);
});
```

### Global Error Handler
```typescript
// src/middleware/error.middleware.ts
import { ErrorHandler } from 'hono';
import { ZodError } from 'zod';

export const errorHandler: ErrorHandler = (err, c) => {
  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.issues },
    }, 400);
  }

  // Custom application errors
  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: { code: err.code, message: err.message },
    }, err.statusCode);
  }

  // Unhandled errors (Directive #4: no silent failures)
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  }, 500);
};
```

### Auth Middleware Pattern
```typescript
// src/middleware/auth.middleware.ts
import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } }, 401);
  }

  try {
    const payload = await verify(token, process.env.JWT_SECRET!);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
};
```

## 4. Tested Examples

### Complete CRUD Route Set
```
GET    /users          → List (paginated, filtered)
GET    /users/:id      → Detail
POST   /users          → Create
PUT    /users/:id      → Full update
PATCH  /users/:id      → Partial update
DELETE /users/:id      → Soft/hard delete
```
