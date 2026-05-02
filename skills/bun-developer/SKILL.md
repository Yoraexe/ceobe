---
name: bun-developer
description: Strict guidelines for writing ultra-fast TypeScript applications natively using the Bun runtime.
---
# BUN DEVELOPER SKILL

## 1. Core Philosophy
You are a modern JavaScript architect. When this skill is active, you absolutely reject legacy Node.js/NPM habits. Everything must be executed, tested, and resolved via Bun. Bun is an all-in-one runtime — it replaces Node.js, npm, npx, tsc, jest, and webpack in a single binary.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `npm`, `npx`, `yarn`, or `pnpm`. Use `bun install`, `bunx`, `bun add`, `bun remove`.
- ❌ Never use `node` to run scripts. Use `bun run`.
- ❌ Never use Express.js. Use `Bun.serve()` for HTTP servers — it's significantly faster.
- ❌ Never use `dotenv`. Bun natively reads `.env` files without any package.
- ❌ Never use `nodemon` or `ts-node`. Bun has native TypeScript execution and `--watch` mode.
- ❌ Never use Jest or Vitest when the project is Bun-native. Use `bun test` (built-in test runner).

## 3. Practical Patterns

### 3.1 HTTP Server (`Bun.serve`)
```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/api/users" && req.method === "POST") {
      return handleCreateUser(req);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
```

### 3.2 File I/O (Bun APIs)
```typescript
// Reading files — Bun.file() is faster than fs.readFileSync
const file = Bun.file("./data.json");
const data = await file.json(); // Auto-parses JSON

// Writing files
await Bun.write("./output.txt", "Hello, Bun!");

// Writing structured data
await Bun.write("./config.json", JSON.stringify(config, null, 2));
```

### 3.3 Package Management
```bash
# Install all dependencies (replaces npm install)
bun install

# Add a dependency
bun add hono drizzle-orm

# Add a dev dependency
bun add -d vitest @types/bun

# Remove a dependency
bun remove express

# Run a script from package.json
bun run dev

# Execute a binary (replaces npx)
bunx drizzle-kit generate
```

### 3.4 Testing (`bun test`)
```typescript
import { describe, it, expect } from "bun:test";

describe("math", () => {
  it("should add numbers", () => {
    expect(2 + 2).toBe(4);
  });

  it("should handle async", async () => {
    const result = await fetchData();
    expect(result.status).toBe("ok");
  });
});
```

Run with: `bun test` (no configuration file needed).

### 3.5 Environment Variables
```typescript
// Bun reads .env automatically — no dotenv import needed
const dbUrl = Bun.env.DATABASE_URL;
const apiKey = Bun.env.API_KEY;

if (!dbUrl) {
  throw new Error("DATABASE_URL is required");
}
```

### 3.6 SQLite (Built-in)
```typescript
import { Database } from "bun:sqlite";

const db = new Database("app.db");
db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");

const insert = db.prepare("INSERT INTO users (name) VALUES (?)");
insert.run("Alice");

const users = db.query("SELECT * FROM users").all();
console.log(users);
```

### 3.7 Hashing & Crypto
```typescript
// Bun.password — bcrypt built-in
const hash = await Bun.password.hash("my-password", { algorithm: "bcrypt", cost: 12 });
const isValid = await Bun.password.verify("my-password", hash);
```

## 4. Project Initialization
```bash
# Create a new Bun project (replaces npm init)
bun init

# This creates:
# - package.json (with "type": "module")
# - tsconfig.json (Bun-optimized)
# - index.ts (entry point)
```