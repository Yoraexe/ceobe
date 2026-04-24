# Skill: Zero-Downtime Migration (DevOps)

## 1. Description
Enterprise-grade deployment strategy for handling database schema changes and app deployments without causing production downtime.

## 2. Trigger
Executed during Phase 5 (DevOps Layer) when preparing deployment scripts for a production environment.

## 3. Rules & Execution
1. **Blue-Green Deployment:** 
   - Maintain two identical environments (Blue and Green). 
   - Deploy new code to Green, run integration tests, then switch the router traffic from Blue to Green.
2. **Backward-Compatible Database Migrations (Expand and Contract Pattern):**
   - **Never drop a column or rename a table in a single step.**
   - *Step 1 (Expand):* Add the new column. Both old and new code can run.
   - *Step 2 (Migrate):* Deploy code that writes to both columns. Run a script to copy old data to the new column.
   - *Step 3 (Contract):* Deploy code that only uses the new column. Finally, drop the old column.
3. **Implementation:** Ensure CI/CD pipelines (`ci.yml`) explicitly define these steps instead of running a blind `migrate push` during deployment.
