# DATABASE SCALING
1. **Indexes:** Every query MUST hit an index. Avoid full table scans.
2. **Read Replicas:** Route heavy GET requests to read-only replicas to free up the primary writer node.
3. **Connection Pooling:** Always use a connection pool (e.g., PgBouncer). Never open a new DB connection per request.