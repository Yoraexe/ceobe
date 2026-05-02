# Index Optimization (Database Architect)

## 1. When to Create an Index
- ✅ Foreign key columns (always).
- ✅ Columns used in `WHERE`, `ORDER BY`, `GROUP BY` frequently.
- ✅ Columns used in `JOIN` conditions.
- ❌ Columns that are rarely queried or have very low cardinality (e.g., boolean `is_active`).

## 2. Composite Index Rules
Order matters! Put the most selective column first:

```sql
-- Good: email is more selective than status
CREATE INDEX idx_users_email_status ON users(email, status);

-- This index supports:
-- WHERE email = 'x'                    ✅
-- WHERE email = 'x' AND status = 'y'   ✅
-- WHERE status = 'y'                   ❌ (leftmost prefix not used)
```

## 3. Partial Indexes (PostgreSQL)
Only index rows that match a condition to save space:

```sql
-- Only index active orders (skip archived ones)
CREATE INDEX idx_orders_active ON orders(created_at)
  WHERE status != 'archived';
```

## 4. Covering Indexes
Include all columns needed by a query to avoid table lookups:

```sql
-- PostgreSQL INCLUDE clause
CREATE INDEX idx_orders_user ON orders(user_id) INCLUDE (total, status);

-- Now this query is index-only (no table fetch needed):
-- SELECT total, status FROM orders WHERE user_id = 42;
```

## 5. EXPLAIN ANALYZE
Always verify index usage:

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
-- Look for "Index Scan" or "Index Only Scan" in the output.
-- If you see "Seq Scan", your index is not being used.
```