# Ceobe Engineering Rules

These rules define global engineering constraints that AI agents must follow when implementing software.

All generated code must respect these rules unless explicitly overridden by project architecture decisions.

---

# 1. Architecture Layering

Applications must follow a layered architecture.

Recommended structure:

- API / Controller layer
- Service layer
- Repository / Data layer

Responsibilities:

API Layer
Handles HTTP requests and responses only.

Service Layer
Contains business logic.

Repository Layer
Handles database access and queries.

Business logic must never be placed inside controllers.

---

# 1.5. Frontend Architecture / Separation of Concerns

Frontend applications (React, Vue, Svelte, Nuxt, Astro) must strictly separate UI syntax from business logic.

Recommended structure:

- Components (UI-only, declarative)
- State Management / Hooks (Reactive logic)
- API Clients (Data fetching and mutations)

Data fetching logic must never be placed directly inside a UI component.

---

# 2. Separation of Concerns

Each module should have a single responsibility.

Do not mix:

- HTTP handling
- business logic
- database queries
- external integrations

Each responsibility should live in its own layer.

---

# 3. Thin Controllers

Controllers or route handlers must remain thin.

Controllers should:

- validate input
- call service functions
- return structured responses

Controllers must NOT contain complex business logic.

---

# 4. Explicit Error Handling

All errors must be handled explicitly.

Avoid silent failures.

Error responses must be consistent and structured.

Example response format:

{
  "success": false,
  "error_code": "RESOURCE_NOT_FOUND",
  "message": "User not found",
  "details": []
}

---

# 5. Consistent Naming Conventions

Use clear and descriptive naming.

Examples:

Services:
userService
authService

Repositories:
userRepository

Handlers:
createUserHandler

Avoid vague names such as:

manager
helper
data

---

# 6. Modular Design

Features must be implemented as modular components.

A feature should ideally contain:

- routes
- service logic
- repository logic

Modules should be loosely coupled.

---

# 7. Framework Isolation

Framework-specific logic must remain isolated.

Example:

Hono or Elysia routing logic should remain inside the API layer.

Business logic should remain framework-agnostic.

This allows the same service logic to be reused across frameworks.

---

# 8. Database Access Rules

Database queries must go through a dedicated data access layer.

Direct database calls from controllers are not allowed.

Repositories must encapsulate database interactions.

---

# 9. Simplicity Over Cleverness

Prefer simple and maintainable implementations.

Avoid unnecessary abstractions or overly complex patterns.

Readable code is preferred over clever code.

---

# 10. Document Important Decisions

When architectural decisions affect the system structure,
they must be documented.

Examples:

- choosing a framework
- selecting an authentication method
- database schema strategy

These decisions should be recorded in project documentation.

---

# 11. Task Decomposition

Large tasks must be decomposed into smaller tasks before implementation begins.

Example (Auction System):

→ create auction table
→ create auction service
→ create auction API

---

# 12. Safe Modification Strategy ("Add, Don't Break")

When extending functionality, PREFER adding new modules rather than modifying large existing files.

Example violations:
Modifying unrelated services because they "seem related".

Correct approach:
Create `authService.ts`.

---

# 13. AI Agent Strict Constraints

All AI agents managing this project MUST:

1. VERIFY file existence before attempting to read or edit.
2. NEVER hallucinate imports or dependencies; always check the `package.json` or equivalent first.
3. FOLLOW exact file paths provided in the task capsule.
4. PREFER precise string replacements over full file replacements for minor edits.

---

# 14. Mandatory File Header Documentation

Every source code file must contain a standardized Header Doc comment at the top.
Format must include:
- Module Name & Purpose
- Caller (Who consumes this file?)
- Dependencies (What does this file call?)
- Important Side Effects

---

# 15. Token Efficiency & Navigation Protocol

Do not perform blind codebase scans.
Before working on an existing codebase, always read or generate `system-map.md`.
Use trace-by-function to navigate. Do not read entire files if only a specific function is needed.

---

# 16. Database Performance Standards (DBA-Grade)

All database queries must be optimized for production scale:
- NEVER use unbounded `SELECT *`. Always select specific columns.
- Prevent N+1 query problems by using joins or batch loaders (e.g., Drizzle `with` or dataloaders).
- Batch inserts for bulk operations.

---

# 17. Pre-Edit Trace Note

Before executing any file modification, the agent must output a brief trace note in its thought process or response:
"Trace: Trigger -> Controller X -> Service Y -> DB Z. Editing Service Y to add..."
This ensures logical alignment before code is written.

---

# 18. Zero-Downtime Database Migrations

AI agents MUST NOT execute destructive database schema changes (e.g., `DROP TABLE`, `ALTER TABLE DROP COLUMN`, renaming columns) in a single step. 
You must strictly enforce the **Expand and Contract** pattern to ensure Zero-Downtime compatibility.
Auditors MUST REJECT any execution plan that violates this rule.