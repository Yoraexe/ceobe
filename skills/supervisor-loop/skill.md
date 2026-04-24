# Skill: Autonomous Supervisor Loop

## 1. Description
The core execution engine of Ceobe. Transforms the CLI from a manual prompt-and-response tool into an autonomous orchestration loop.

## 2. Trigger
When a user submits a raw request or Business Requirement.

## 3. Rules & Execution
1. **The Loop Sequence:** 
   `Phase 1 (Product)` -> `Phase 2 (Design)` -> `Phase 3 (Engineering)` -> `Phase 4 (Quality)` -> `Phase 5 (DevOps)`.
2. **Auto-Transition:** Ceobe MUST automatically transition to the next phase upon successful completion of the current phase.
3. **No Human Polling:** Do not stop and ask "Should I proceed to Design?" unless the current phase defines a strict *Halt for Approval* condition.
4. **Fail Conditions:** If any phase fails (e.g., Quality audit fails due to low coverage), the Supervisor automatically routes back to the responsible layer (Engineering) with the error payload.
5. **State Tracking:** Always update `ceobe-state.json` to track the current loop iteration.
