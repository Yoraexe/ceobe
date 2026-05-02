# Skill: Drizzle ORM Architecture

## 1. Metadata
- **Name:** `drizzle`
- **Origin:** `Astesia Core`
- **Description:** Standards for designing database schemas and executing queries using Drizzle ORM. Enforces type safety, strict relational mapping, and performance.

## 2. When to Use
Invoke this skill when building a backend that interacts with a SQL database (PostgreSQL, MySQL, SQLite) using Drizzle ORM.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never mix Drizzle schema definitions with application logic. Keep schemas in `src/db/schema.ts`.
- ❌ Never use raw SQL strings unless Drizzle explicitly does not support the operation (use `sql\`...\`` builder instead).
- ❌ Never select all columns (`select()`) if you only need one or two. Be explicit.

## 4. Practical Patterns (PostgreSQL Example)

### Schema Definition
```typescript
// src/db/schema.ts
import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Table Definitions
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Relations (For Drizzle Relational Queries)
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// 3. Types Inference
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

### Database Connection Setup
```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Pass schema to enable the relational query API
export const db = drizzle(pool, { schema });
```

### Relational Queries (Easy mode)
```typescript
// Fetch user with their posts in one query
const userWithPosts = await db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, 1),
  with: {
    posts: {
      limit: 5,
      columns: { id: true, title: true } // Only fetch what's needed
    }
  }
});
```

### Traditional Query Builder (SQL-like mode)
```typescript
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, posts } from '../db/schema';

// 1. Insert and return
const newUser = await db.insert(users)
  .values({ email: 'test@example.com', name: 'John' })
  .returning(); // Returns the inserted row

// 2. Join and Aggregate
const userPostCounts = await db.select({
    userId: users.id,
    name: users.name,
    postCount: sql<number>`count(${posts.id})`.mapWith(Number)
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId))
  .groupBy(users.id, users.name)
  .orderBy(desc(sql`count(${posts.id})`));

// 3. Update
await db.update(users)
  .set({ isActive: false })
  .where(eq(users.id, 1));

// 4. Delete
await db.delete(posts)
  .where(eq(posts.authorId, 1));
```

### Transactions
```typescript
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ name: 'Alice', email: 'alice@test.com' }).returning();
  
  await tx.insert(posts).values({
    title: 'First Post',
    content: 'Hello world',
    authorId: user.id
  });
  // If anything fails, the transaction rolls back automatically
});
```
