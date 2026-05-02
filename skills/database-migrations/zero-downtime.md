# SKILL: ZERO-DOWNTIME DATABASE MIGRATIONS

You are equipped with DBA-grade knowledge on how to manage database schema evolution safely.
For any database task (e.g. PostgreSQL, MySQL) managed via Prisma, Drizzle, TypeORM, or raw SQL, you MUST adhere to the following constraints.

## 1. The Core Law of Database Schema

**NEVER EXECUTE DESTRUCTIVE MIGRATIONS IN A SINGLE STEP.**
A destructive migration is any operation that removes or fundamentally alters existing data structures that the current running application might still be querying. This includes:
- `DROP TABLE`
- `ALTER TABLE DROP COLUMN`
- `ALTER TABLE RENAME COLUMN`
- `ALTER TABLE ALTER COLUMN TYPE` (if it causes data loss or cast errors)
- Adding a `NOT NULL` column without a default value to an existing table.

## 2. The Expand and Contract Pattern

To safely evolve schemas without causing downtime (Blue-Green Deployment compatibility), you MUST break down destructive changes into 4 distinct phases:

### Phase 1: Expand
Add the new schema elements.
- Create the new column(s) or table(s).
- If replacing a column, the new column MUST be nullable initially.
- Do NOT delete the old column.
- Write the application code to read from the old column, but start writing to BOTH the old and new columns (Dual-Write).

### Phase 2: Migrate (Backfill)
- Write a background script or data migration (DML) to copy/backfill existing data from the old schema to the new schema.
- Ensure all historical records in the new column are populated.

### Phase 3: Contract (Code Cutover)
- Update the application code to strictly read and write ONLY from the new column/table.
- Deploy the application. At this point, the old column is entirely ignored by the application.

### Phase 4: Cleanup
- ONLY AFTER Phase 3 is fully deployed and verified, create a final migration to safely `DROP` the old column or table.

## 3. Separation of DDL and DML
Data Definition Language (DDL - `CREATE`, `ALTER`, `DROP`) and Data Manipulation Language (DML - `INSERT`, `UPDATE`, `DELETE`) migrations MUST NOT be mixed in the same migration file if the DDL locks the table for an extended period. Backfilling a large table should be done in batches via application scripts or distinct concurrent SQL migrations, not bundled with the schema lock.

## 4. AI Auditor Enforcement
When acting as an Auditor, if you see an execution plan that proposes renaming a column or dropping a table in one single Pull Request / Task sequence, you MUST REJECT THE PLAN and demand it be split into Expand, Backfill, and Contract phases.
