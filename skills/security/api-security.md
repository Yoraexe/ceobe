# API SECURITY
1. **Rate Limiting:** Protect all endpoints against brute-forcing.
   ```typescript
   // Example (Hono)
   import { rateLimit } from 'hono-rate-limit';
   app.use('/auth/*', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }));
   ```
2. **CORS:** Strictly configure CORS origins. Never use `*` with credentials.
   ```typescript
   // Example (Hono)
   app.use('*', cors({ origin: 'https://trusted.com', credentials: true }));
   ```