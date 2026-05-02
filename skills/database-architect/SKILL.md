---
name: database-architect
description: Rules for designing highly performant, normalized, and scalable database schemas.
---
# DATABASE ARCHITECT SKILL

## 1. Core Philosophy
Data outlives code. A bad codebase can be rewritten, but a bad database schema will haunt a company for decades. Design for normalization, enforce constraints at the database level, and optimize for reads.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `TEXT` or `VARCHAR` for ID columns unless it's a UUID/ULID. Use `SERIAL`, `BIGSERIAL`, or `INT`.
- ❌ Never store JSON blobs for data that needs to be queried, filtered, or joined. Only use JSONB for truly schemaless payloads.
- ❌ Never use `DELETE` on critical records without an audit log. Use soft deletes (`deleted_at TIMESTAMP`).
- ❌ Never perform N+1 queries. Always use SQL `JOIN`s or data loaders to fetch related entities in a single batch.

## 3. Practical Patterns

### 3.1 The 3rd Normal Form (3NF)
Ensure every non-key column depends directly on the primary key, and nothing but the primary key.
Instead of storing `company_name` in the `users` table, store `company_id` and create a `companies` table.

### 3.2 Indexing Strategies
Always index foreign keys and columns used frequently in `WHERE`, `ORDER BY`, or `GROUP BY` clauses.

```sql
-- PostgreSQL Example
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    company_id INT NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Critical: Index the foreign key to speed up JOINs
CREATE INDEX idx_users_company_id ON users(company_id);

-- Partial index for fast lookup of active users
CREATE INDEX idx_users_active ON users(company_id) WHERE deleted_at IS NULL;
```

### 3.3 Connection Pooling & Transactions
Never open a direct connection for every web request. Use connection pools (like `pgBouncer` or `pg.Pool` in Node).
Wrap multi-step inserts in transactions to prevent orphaned data.

```typescript
// Example using pg pool and transactions
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createOrder(userId: number, total: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const orderRes = await client.query(
      'INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id',
      [userId, total]
    );
    const orderId = orderRes.rows[0].id;
    
    await client.query(
      'UPDATE users SET order_count = order_count + 1 WHERE id = $1',
      [userId]
    );
    
    await client.query('COMMIT');
    return orderId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release(); // ALWAYS release back to pool
  }
}
```

### 3.4 Data Integrity (Constraints)
Rely on the database, not the application code, to guarantee data integrity.

```sql
ALTER TABLE products 
  ADD CONSTRAINT price_must_be_positive CHECK (price >= 0);

ALTER TABLE employees
  ADD CONSTRAINT unique_email UNIQUE (email);
```