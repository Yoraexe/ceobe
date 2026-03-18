# MOCKING STRATEGIES
1. **External APIs:** NEVER call third-party APIs (Stripe, Twilio) in tests. Use MSW (Mock Service Worker) or Jest/Vitest spy functions to intercept and return fake responses.
2. **Time Dependency:** If a function depends on `Date.now()`, mock the system time so assertions don't fail intermittently.