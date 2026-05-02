# Skill: Autonomous Supervisor Loop

## 1. Description
The core execution engine of Ceobe. Transforms the CLI from a manual prompt-and-response tool into an autonomous orchestration loop.

## 2. Trigger
When a user submits a raw request or Business Requirement via `ceobe auto <description>`.

## 3. Architecture Reference
This skill is implemented by the Supervisor module:
- **Orchestrator:** `src/ai/supervisor.ts` — Contains `runAutonomousLoop()` which manages the full 6-phase SDLC pipeline.
- **State Tracking:** `src/utils/stateManager.ts` — Persists the current phase to `.ceobe/ceobe-state.json` with in-memory caching and file-based mutex locking.
- **Executor:** `src/ai/executor.ts` — The Claude-powered execution engine that receives architecture and design context, handles token truncation recovery, and manages the tool-call loop.

## 4. Rules & Execution
1. **The Loop Sequence:**
   `Phase 1 (Product/BRD)` → `Phase 2 (Design)` → `Phase 3 (Architecture)` → `Phase 3.5 (DevOps)` → `Phase 4 (Quality Audit)` → `Phase 5 (Execute)` → `Phase 6 (Verify)`.
2. **Auto-Correction:** If the Audit phase fails, the Supervisor automatically feeds the auditor's feedback back into the Planning phase and regenerates all documents. Maximum 3 retry cycles.
3. **Auto-Transition:** Ceobe MUST automatically transition to the next phase upon successful completion. No human polling unless `--ask` flag is set.
4. **Execution Retry:** If post-execution verification fails (e.g., `tsc --noEmit` reports errors), the Supervisor feeds the error output back into the Executor and retries. Maximum 3 cycles.
5. **Fail Conditions:** If any phase exceeds its retry limit, the Supervisor halts gracefully and reports the last error.
6. **State Tracking:** Always update `ceobe-state.json` before transitioning phases. This enables crash recovery via `readState()` on restart.
7. **Zombie Cleanup:** The Supervisor's `finally` block kills all background processes spawned during execution.

## 5. Anti-Patterns
- ❌ Never skip the Audit phase — unaudited plans produce architecturally inconsistent code.
- ❌ Never proceed to execution without injecting Architecture + Design context into the Executor's system prompt.
- ❌ Never ignore the `completedFiles` list when resuming — re-creating already-completed files wastes tokens and risks overwriting correct code.
