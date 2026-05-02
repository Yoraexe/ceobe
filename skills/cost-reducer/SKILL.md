# Skill: Cost Reduction Engineering

## 1. Metadata
- **Name:** `cost-reducer`
- **Origin:** `Astesia Core`
- **Description:** Principles and patterns for writing software that is highly economical to run, scale, and maintain. Covers dependency hygiene, compute optimization, and LLM token efficiency.

## 2. When to Use
Invoke this skill when:
- Building applications that will run on paid cloud infrastructure.
- The project uses LLM APIs (token costs must be minimized).
- The BRD mentions "cost-effective," "budget," or "serverless."

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never install a library for something achievable in < 20 lines of code.
- ❌ Never make redundant API calls — cache aggressively.
- ❌ Never send full file contents to an LLM when a summary suffices.
- ❌ Never use `SELECT *` — select only the columns you need.
- ❌ Never deploy fat Docker images — use multi-stage builds with slim bases.

## 4. Practical Patterns

### Dependency Hygiene
```
# Before adding a dependency, ask:
# 1. Can I write this in < 20 lines? → Write it yourself.
# 2. Is it a micro-package with 1 function? → Write it yourself.
# 3. Does it have > 10 transitive deps? → Find a leaner alternative.

# Example: DON'T install `is-odd` or `left-pad`.
# Example: DO install `zod` (complex validation) or `drizzle-orm` (SQL builder).
```

### Docker Multi-Stage Builds
```dockerfile
# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: Production (minimal image)
FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
# Result: ~150MB instead of ~1.2GB
```

### LLM Token Budgeting
```
# When integrating LLM APIs (OpenAI, Gemini, Claude):
# 1. Use the cheapest model that meets quality requirements.
#    - Classification/routing → gemini-flash (cheap, fast)
#    - Complex reasoning → gemini-pro or claude-sonnet
#    - Never use opus/ultra for simple tasks.
# 2. Cache LLM responses for identical inputs (Redis with TTL).
# 3. Truncate context — send only relevant excerpts, not full documents.
# 4. Use structured output (JSON mode) to avoid parsing overhead.
```

### Lazy Loading & Code Splitting (Frontend)
```typescript
// Don't import heavy components upfront
const HeavyChart = lazy(() => import('./components/HeavyChart'));

// Only load when needed
<Suspense fallback={<Spinner />}>
  <HeavyChart />
</Suspense>
```

### Database Query Optimization
```typescript
// ✅ Select only needed columns
const users = await db.select({ id: users.id, name: users.name }).from(users);

// ❌ Select everything
const users = await db.select().from(users); // Returns ALL columns
```

## 5. Cost Checklist
- [ ] No unnecessary dependencies (audit with `npm ls --depth=0`)
- [ ] Docker image uses multi-stage build (< 200MB)
- [ ] LLM calls use the cheapest viable model
- [ ] LLM responses cached for identical inputs
- [ ] Database queries select only needed columns
- [ ] Static assets served from CDN, not application server