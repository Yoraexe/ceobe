# TRIGGER.DEV ADVANCED
1. **Idempotency:** Background jobs retry on failure. Ensure your database queries and logic inside `trigger.dev` tasks are idempotent (running them twice doesn't duplicate data).
2. **Resumes:** Use `wait` functionalities to pause execution without taking up compute execution limits.