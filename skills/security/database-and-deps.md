# DATABASE & DEPENDENCIES
1. **SQL Injection:** ALWAYS use parameterized queries or trusted ORMs. Never concatenate strings into SQL statements.
2. **Deps:** Audit packages regularly (`npm audit`). Do not install obscure unmaintained libraries.