# WEB SECURITY
1. **XSS Protection:** Sanitize all user inputs before rendering. Never use `innerHTML` or `{@html}` with raw user data.
   ```typescript
   // ❌ BAD (Svelte)
   {@html userComment}
   
   // ✅ GOOD — Use a sanitizer library
   import DOMPurify from 'dompurify';
   {@html DOMPurify.sanitize(userComment)}
   ```
2. **Headers:** Set strict security headers in production. In Hono:
   ```typescript
   import { secureHeaders } from 'hono/secure-headers';
   app.use('*', secureHeaders());
   // Sets: X-Content-Type-Options, X-Frame-Options, CSP, HSTS, etc.
   ```
3. **CSRF:** For cookie-based auth, enforce SameSite=Strict and use anti-CSRF tokens on mutation endpoints.