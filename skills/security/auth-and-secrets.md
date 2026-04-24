# AUTH & SECRETS
1. **Never commit `.env`** files or hardcode API keys. Use `.env.example` as a reference.
   ```bash
   # .gitignore — mandatory entries
   .env
   .env.local
   .env.production
   ```
2. **Hash passwords** with bcrypt or Argon2. NEVER store plain text.
   ```typescript
   import { hash, verify } from '@node-rs/argon2';
   
   // Registration
   const passwordHash = await hash(rawPassword);
   
   // Login verification
   const isValid = await verify(storedHash, rawPassword);
   ```
3. **Short-lived JWTs** (15 min access) + long-lived Refresh Tokens in `HttpOnly` cookies.
   ```typescript
   // Cookie settings for refresh token
   setCookie(c, 'refresh_token', token, {
     httpOnly: true,
     secure: true,
     sameSite: 'Strict',
     maxAge: 60 * 60 * 24 * 7, // 7 days
     path: '/auth/refresh',
   });
   ```