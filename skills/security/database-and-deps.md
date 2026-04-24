# DATABASE & DEPENDENCIES
1. **SQL Injection:** ALWAYS use parameterized queries or trusted ORMs.
   ```typescript
   // ❌ BAD
   db.execute(`SELECT * FROM users WHERE email = '${email}'`);
   
   // ✅ GOOD (Drizzle ORM)
   db.select().from(users).where(eq(users.email, email));
   ```
2. **Deps:** Audit packages regularly (`npm audit`). Do not install obscure unmaintained libraries.