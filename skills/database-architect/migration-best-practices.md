# MIGRATIONS
1. **Immutable History:** Never rewrite a migration that has already been executed in production. Always write a new migration to alter the state.
2. **Backwards Compatibility:** All database schema changes (adding, renaming, dropping columns) MUST be backward compatible. Deploy the DB change first, then the code.