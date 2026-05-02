# Skill: Scalability Engineering

## 1. Metadata
- **Name:** `scalability`
- **Origin:** `Astesia Core`
- **Description:** Principles and concrete patterns for designing systems capable of handling 10x to 1000x traffic spikes. Covers horizontal scaling, caching, connection pooling, and queue-based architecture.

## 2. When to Use
Invoke this skill when:
- Building APIs expected to serve > 1,000 concurrent users.
- The BRD mentions "high availability," "load balancing," or "real-time."
- The architecture involves microservices or distributed systems.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use in-memory state that is lost between restarts (use Redis/DB).
- ❌ Never open a new DB connection per request (use connection pooling).
- ❌ Never perform heavy computation synchronously in an HTTP handler.
- ❌ Never hardcode instance IPs — use service discovery or DNS.
- ❌ Never use `SELECT *` on tables expected to have millions of rows.

## 4. Practical Patterns

### Connection Pooling (PostgreSQL)
```typescript
// drizzle + node-postgres with pool
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool);
```

### Caching Layer (Redis)
```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getCachedUser(id: string) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  const user = await db.select().from(users).where(eq(users.id, id));
  await redis.setex(`user:${id}`, 300, JSON.stringify(user)); // TTL 5 min
  return user;
}
```

### Rate Limiting
```typescript
// Per-IP rate limiting using sliding window
import { rateLimiter } from 'hono-rate-limiter';

app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  limit: 100,            // 100 requests per window per IP
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
}));
```

### Background Job Queues
```typescript
// Offload heavy work to a queue instead of blocking the HTTP response
import { Queue, Worker } from 'bullmq';

const emailQueue = new Queue('email', { connection: redis });

// In handler — enqueue, don't process:
app.post('/users', async (c) => {
  const user = await userService.create(data);
  await emailQueue.add('welcome', { userId: user.id }); // Non-blocking
  return c.json({ success: true, data: user }, 201);
});

// Worker runs separately:
new Worker('email', async (job) => {
  await sendWelcomeEmail(job.data.userId);
}, { connection: redis });
```

### Pagination (Cursor-Based)
```typescript
// Cursor-based pagination scales better than OFFSET for large datasets
app.get('/users', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit') || 20), 100);

  const query = db.select().from(users).orderBy(users.id).limit(limit + 1);
  if (cursor) query.where(gt(users.id, cursor));

  const results = await query;
  const hasMore = results.length > limit;
  if (hasMore) results.pop();

  return c.json({
    data: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
  });
});
```

## 5. Architecture Checklist
- [ ] Stateless application servers (no in-memory sessions)
- [ ] Database connection pooling configured
- [ ] Caching layer for frequently-read data (Redis)
- [ ] Heavy work offloaded to background queues
- [ ] Cursor-based pagination for list endpoints
- [ ] Rate limiting on all public endpoints
- [ ] Health check endpoint for load balancer probes