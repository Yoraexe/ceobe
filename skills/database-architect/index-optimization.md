# INDEX OPTIMIZATION
1. **Foreign Keys:** Every foreign key column MUST have a corresponding index to speed up JOIN operations.
2. **Composite Indexes:** Use composite indexes for queries that filter by multiple columns (e.g., `WHERE status = ? AND created_at > ?`). Order matters: most selective column first.