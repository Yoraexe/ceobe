# API & SERVICES SCALING
1. **Stateless First:** APIs must be 100% stateless. Do not store session data in the Node.js process.
2. **Circuit Breakers:** If an external service is down, fail fast using circuit breaker patterns.