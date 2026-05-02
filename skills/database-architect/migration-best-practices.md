# Migration Best Practices (Database Architect)

## 1. Golden Rules
- Always use migration tools (Drizzle `generate`/`push`, Prisma `migrate`, Alembic, goose) instead of raw SQL on production.
- Never modify a migration file after it has been applied to any environment.
- Always test migrations against a copy of production data before deploying.

## 2. Safe Migration Patterns

### Adding a Column
```sql
-- ✅ Safe: Add with a default so existing rows aren't locked
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '';
```

### Renaming a Column (Zero-Downtime)
1. Add the new column.
2. Deploy code that writes to BOTH old and new columns.
3. Backfill old rows: `UPDATE users SET new_col = old_col WHERE new_col IS NULL`.
4. Deploy code that reads from new column only.
5. Drop the old column in a future migration.

### Dropping a Column
```sql
-- ❌ NEVER drop immediately if the old app version still references it.
-- ✅ First: Deploy code that no longer reads/writes the column.
-- ✅ Then: Drop in a follow-up migration.
ALTER TABLE users DROP COLUMN legacy_field;
```

## 3. Drizzle ORM Specifics
```bash
# Development: Push schema directly (fast, no migration files)
npx drizzle-kit push

# Production: Generate SQL migration files for review
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```