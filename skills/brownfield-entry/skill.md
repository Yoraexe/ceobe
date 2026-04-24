# Skill: Brownfield Entry Protocol

## 1. Description
Protocol for analyzing and entering an existing codebase without wasting token context.

## 2. Trigger
When Ceobe is initialized inside a directory that already contains code (not empty).

## 3. Rules & Execution
1. **Never perform a blind full-scan** of the directory.
2. Locate the main entrypoint (`package.json` main, `index.ts`, `main.go`).
3. Trace the execution path function-by-function.
4. Generate `.ceobe/system-map.md` using the `system-map-template.md`.
5. For all subsequent tasks, read `system-map.md` first to identify which specific files need to be edited, rather than scanning the whole tree.
