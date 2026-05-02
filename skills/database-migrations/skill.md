# Skill: Database Migrations Workflow

## 1. Metadata
- **Name:** `database-migrations`
- **Origin:** `Astesia Core`
- **Description:** Protocols for safely evolving database schemas without data loss. Covers the difference between prototyping (`push`) and production migrations (`generate`).

## 2. When to Use
Invoke this skill when modifying database schema files or preparing a project for deployment.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never run `drizzle-kit push` against a production database.
- ❌ Never edit a generated `.sql` migration file manually unless adding custom complex SQL that Drizzle can't infer.
- ❌ Never ignore schema drift warnings.

## 4. Workflows

### Scenario A: Local Development / Prototyping
During early development, when data can be safely dropped or when schemas change rapidly:

1. Edit `src/db/schema.ts`.
2. Use `drizzle-kit push` to forcefully synchronize the local database with the schema.
   ```bash
   npx drizzle-kit push
   ```
   *Note: This does not generate SQL files. It alters the DB directly. It will warn if data might be lost.*

### Scenario B: Production / Staging (The Safe Way)
When deploying to a remote environment where data preservation is critical:

1. **Generate the Migration SQL:**
   ```bash
   npx drizzle-kit generate --name=add_user_profile
   ```
   This reads `schema.ts`, compares it to previous migrations, and creates a new `drizzle/000X_add_user_profile.sql` file.

2. **Run the Migration (Using Code):**
   Do not rely on the CLI in production. Run migrations on app startup or via a dedicated CI script.
   ```typescript
   // src/db/migrate.ts
   import { drizzle } from 'drizzle-orm/node-postgres';
   import { migrate } from 'drizzle-orm/node-postgres/migrator';
   import { Pool } from 'pg';
   import * as path from 'path';

   async function runMigrations() {
     console.log('Running migrations...');
     const pool = new Pool({ connectionString: process.env.DATABASE_URL });
     const db = drizzle(pool);
     
     // This will execute any un-run .sql files in the 'drizzle' folder
     await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
     
     console.log('Migrations complete!');
     await pool.end();
   }

   runMigrations().catch(console.error);
   ```

## 5. Drizzle Config
Always ensure `drizzle.config.ts` is correctly set up at the project root:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle', // Migration files output folder
  dialect: 'postgresql', // 'postgresql' | 'mysql' | 'sqlite'
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```
