# Skill: Brownfield Entry Protocol

## 1. Metadata
- **Name:** `brownfield-entry`
- **Origin:** `Astesia Core`
- **Description:** Protocol for safely analyzing and modifying an existing codebase without full-scan token waste. Emphasizes surgical understanding over brute-force scanning.

## 2. When to Use
When Ceobe is initialized inside a directory that already contains code (not empty). Detected by the presence of `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, or a `src/` directory.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never `read_file` on every file in the project. You will waste context.
- ❌ Never overwrite existing files with `write_file` unless you have read them first. Use `edit_file` for targeted patches.
- ❌ Never install dependencies that conflict with existing `package.json` / `go.mod`.
- ❌ Never change the existing project structure (folder layout) unless explicitly asked.

## 4. Entry Protocol (Step-by-Step)

### Step 1: Locate Entrypoint
```
Use `list_directory` on the root.
Identify: package.json, go.mod, Cargo.toml, or pyproject.toml.
Read the entrypoint file (e.g., src/index.ts, cmd/main.go).
```

### Step 2: Trace Dependencies
```
From the entrypoint, read imported modules one level deep.
Build a mental map of: Routes → Services → Repositories → Database.
Do NOT read utility files unless directly referenced.
```

### Step 3: Generate System Map
Create `.ceobe/system-map.md` following this format:

```markdown
# System Map

## Tech Stack
- Runtime: Bun 1.1
- Framework: Hono
- Database: PostgreSQL via Drizzle ORM

## Module Map
| Module | Entrypoint | Dependencies |
|:-------|:-----------|:-------------|
| Auth | src/modules/auth/auth.routes.ts | auth.service → auth.repository → db |
| User | src/modules/user/user.routes.ts | user.service → user.repository → db |

## Key Files
- src/index.ts — App bootstrap, route mounting
- src/db/schema.ts — Database schema (Drizzle)
- src/middleware/auth.ts — JWT middleware

## Conventions Observed
- Modular structure (routes/service/repository per domain)
- Zod validation at route boundary
- Error handling via global onError handler
```

### Step 4: Surgical Modification
- ALWAYS read `system-map.md` before making changes.
- ALWAYS use `edit_file` for modifications to existing files.
- ALWAYS use `semantic_search` to find related code before editing.
- For new features: create new module directories; never modify unrelated modules.

## 5. Token Budget Guidelines
| Action | Max Token Cost |
|:-------|:---------------|
| Initial scan (entrypoint + 1 level) | ~2,000 tokens |
| System map generation | ~1,000 tokens |
| Targeted file read (per file) | ~500 tokens |
| Full project scan (AVOID) | ~50,000+ tokens |
