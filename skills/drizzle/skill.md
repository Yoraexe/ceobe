# Skill: Drizzle ORM + PostgreSQL

## 1. Metadata
- **Name:** `drizzle-orm`
- **Origin:** `Astesia Core`
- **Description:** Schema definition, migrations, and query patterns using Drizzle ORM with PostgreSQL. Enforces Engineering Directive #8 (Repository Pattern) and Directive #21 (DBA-Grade Standards).

## 2. When to Use
Invoke this skill when:
- The architecture specifies Drizzle ORM as the data access layer.
- Setting up a new database schema from `brd.md` entity definitions.
- Writing repository-layer query logic.
- Running or generating database migrations.

## 3. Practical Guidance

### Schema Definition
Schemas are the single source of truth for both database structure AND TypeScript types.

```typescript
// src/db/schema.ts
import { pgTable, serial, varchar, timestamp, integer, boolean, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations (for query builder)
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
```

### Database Connection
```typescript
// src/db/connection.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // NEVER hardcode (Directive #17)
  max: 20,
});

export const db = drizzle(pool, { schema });
```

### Repository Pattern (Directive #8 Compliance)
```typescript
// src/repositories/user.repository.ts
import { eq, ilike, and, desc } from 'drizzle-orm';
import { db } from '../db/connection';
import { users } from '../db/schema';

export const userRepository = {
  async findAll(opts: { page: number; limit: number }) {
    // Directive #21: Bounded query, no SELECT *
    return db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(desc(users.createdAt))
    .limit(opts.limit)
    .offset((opts.page - 1) * opts.limit);
  },

  async findById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  },

  async create(data: typeof users.$inferInsert) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  // Directive #21: Batch insert for bulk operations
  async createMany(data: (typeof users.$inferInsert)[]) {
    return db.insert(users).values(data).returning();
  },

  async update(id: number, data: Partial<typeof users.$inferInsert>) {
    const [user] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  },

  async delete(id: number) {
    const [user] = await db.delete(users).where(eq(users.id, id)).returning();
    return user ?? null;
  },
};
```

### Migration Workflow
```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Interactive studio (development only)
npx drizzle-kit studio
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## 4. Tested Examples

### Avoiding N+1 (Directive #21)
```typescript
// ❌ N+1 — fetches posts individually per user
const users = await db.select().from(usersTable);
for (const user of users) {
  user.posts = await db.select().from(postsTable).where(eq(postsTable.authorId, user.id));
}

// ✅ Relational query — single query with join
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
  limit: 20,
});
```
