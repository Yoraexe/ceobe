# Normalization Rules (Database Architect)

## First Normal Form (1NF)
- Every column contains only atomic (indivisible) values.
- No repeating groups or arrays in a single column.

```sql
-- ❌ Bad: Multiple phone numbers in one column
-- phones: "555-1234, 555-5678"

-- ✅ Good: Separate table
CREATE TABLE user_phones (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  phone VARCHAR(20) NOT NULL
);
```

## Second Normal Form (2NF)
- Must be in 1NF.
- Every non-key column depends on the ENTIRE primary key (relevant for composite keys).

```sql
-- ❌ Bad: student_name depends only on student_id, not the composite key
-- PRIMARY KEY (student_id, course_id), student_name

-- ✅ Good: Move student_name to a students table
CREATE TABLE students (id SERIAL PRIMARY KEY, name TEXT);
CREATE TABLE enrollments (student_id INT, course_id INT, grade CHAR(1), PRIMARY KEY (student_id, course_id));
```

## Third Normal Form (3NF)
- Must be in 2NF.
- No transitive dependencies (a non-key column depends on another non-key column).

```sql
-- ❌ Bad: city depends on zip_code, not on the primary key
-- users: id, name, zip_code, city

-- ✅ Good: Move city to a zip_codes table
CREATE TABLE zip_codes (zip VARCHAR(10) PRIMARY KEY, city TEXT);
CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, zip VARCHAR(10) REFERENCES zip_codes(zip));
```

## When to Denormalize
- **Read-heavy dashboards** where JOINs across 5+ tables cause unacceptable latency.
- **Materialized views** for precomputed aggregations.
- **Always document** the reason for denormalization in a code comment.