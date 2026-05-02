---
name: know-me
description: Guidelines for tracking user preferences, project context, and personalizing the AI experience.
---
# KNOW-ME SKILL (User Memory & Personalization)

## 1. Core Philosophy
You remember the user. Their tech stack preferences, naming conventions, coding style, and past decisions are all valuable context. Use this skill to build a persistent mental model of the user.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never store raw API keys, passwords, or PII in memory files. Only store preferences and patterns.
- ❌ Never override user preferences without explicit confirmation.
- ❌ Never assume a preference from a single interaction. Look for repeated patterns across multiple sessions.

## 3. What to Track

### 3.1 Technical Preferences
- **Preferred language/runtime:** TypeScript, Go, Python, Rust, etc.
- **Preferred framework:** SvelteKit, Next.js, Hono, Elysia, etc.
- **Preferred ORM:** Drizzle, Prisma, GORM, SQLAlchemy, etc.
- **Preferred CSS approach:** Vanilla CSS, Tailwind, CSS Modules, etc.
- **Preferred package manager:** npm, pnpm, bun, yarn.
- **Preferred test framework:** Vitest, Jest, Playwright, pytest.

### 3.2 Coding Style
- **Naming conventions:** camelCase vs snake_case, file naming patterns.
- **Error handling style:** Result types vs try/catch vs Go-style error returns.
- **Comment density:** Minimal vs verbose documentation.
- **Import organization:** Sorted alphabetically, grouped by type, etc.

### 3.3 Project Context
- **Active projects:** Name, tech stack, current phase.
- **Common patterns:** Preferred folder structures, middleware chains, auth strategies.
- **Known issues:** Recurring bugs or environment quirks.

## 4. Memory Operations

### 4.1 Reading Memory
Before starting any new task, check if the user has established preferences:
1. Read `.ceobe/user-preferences.json` if it exists.
2. Cross-reference with the current project's tech stack.
3. Apply preferences silently (don't announce "I remember you like Drizzle").

### 4.2 Writing Memory
After a user explicitly states a preference or you detect a strong pattern:
1. Update `.ceobe/user-preferences.json` with the new preference.
2. Include a timestamp and confidence level.

```json
{
  "preferences": {
    "orm": { "value": "drizzle", "confidence": "high", "lastSeen": "2026-05-01" },
    "css": { "value": "vanilla", "confidence": "medium", "lastSeen": "2026-04-28" },
    "runtime": { "value": "bun", "confidence": "high", "lastSeen": "2026-05-02" }
  }
}
```