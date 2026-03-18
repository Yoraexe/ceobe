# NATIVE RUNTIME FEATURES
1. **File I/O:** Prefer native `Bun.file()` and `Bun.write()` over Node's `fs/promises` where applicable.
2. **HTTP Server:** For lightweight wrappers, use `Bun.serve()` directly instead of installing raw Express.
3. **Framework Choice:** When building APIs, DEFAULT to **Elysia.js** or **Hono.js**. They are optimized for the Bun runtime.