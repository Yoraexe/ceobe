# Skill: Application Security (OWASP Top 10)

## 1. Metadata
- **Name:** `security`
- **Origin:** `Astesia Core`
- **Description:** Mandatory security practices to prevent XSS, Injection, CSRF, and unauthorized access. Enforces OWASP Top 10 compliance.

## 2. When to Use
Invoke this skill for EVERY project. Security is not optional.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never store passwords in plaintext. Always hash with bcrypt/argon2.
- ❌ Never concatenate user input into SQL queries.
- ❌ Never disable CORS in production (`Access-Control-Allow-Origin: *` is dev-only).
- ❌ Never expose stack traces or internal errors to the client.
- ❌ Never commit `.env` files or secrets to version control.
- ❌ Never trust `req.body`, `req.params`, or `req.query` without validation.

## 4. Practical Patterns

### Input Validation (Zod / Go validator)
```typescript
// Always validate ALL user input at the boundary (routes/handlers)
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
});

// In route handler:
const data = createUserSchema.parse(await c.req.json());
```

### SQL Injection Prevention
```typescript
// ✅ CORRECT: Parameterized query
const user = await db.select().from(users).where(eq(users.id, userId));

// ❌ WRONG: String concatenation
const user = await db.execute(`SELECT * FROM users WHERE id = '${userId}'`);
```

### Password Hashing
```typescript
import { hash, verify } from '@node-rs/argon2';

// On registration:
const hashedPassword = await hash(plainPassword);

// On login:
const isValid = await verify(hashedPassword, plainPassword);
```

### CSRF Protection
```typescript
// Use SameSite cookies + CSRF tokens for state-changing operations
app.use('*', csrf({
  origin: ['https://yourdomain.com'],
}));
```

### Security Headers (Helmet / Manual)
```typescript
// Set security headers on every response
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'");
});
```

### Rate Limiting
```typescript
// Prevent brute force on auth endpoints
app.use('/auth/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
}));
```

### Environment Variable Handling
```typescript
// Never hardcode secrets. Always load from environment.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');
```

## 5. Production Checklist
- [ ] All user input validated with Zod/Joi/Go validator
- [ ] All passwords hashed (argon2/bcrypt)
- [ ] All SQL queries use parameterized statements
- [ ] CORS configured to specific origins (not `*`)
- [ ] Security headers set (CSP, HSTS, X-Frame-Options)
- [ ] Rate limiting on auth endpoints
- [ ] No secrets in codebase or logs
- [ ] HTTPS enforced in production