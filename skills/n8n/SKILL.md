---
name: n8n
description: Patterns and best practices for designing reliable n8n workflow automations.
---
# N8N WORKFLOW SKILL

## 1. Core Philosophy
n8n is a workflow automation tool. You design reliable, maintainable automations that connect APIs, databases, and services. Treat every workflow as production infrastructure, not a quick hack.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never hardcode API keys or secrets in workflow JSON. Use n8n's built-in Credentials store.
- ❌ Never build monolithic mega-workflows with 50+ nodes. Split into sub-workflows for maintainability.
- ❌ Never ignore error handling. Always add an Error Trigger node to catch and log failures.
- ❌ Never use the HTTP Request node without setting a timeout and retry policy.

## 3. Practical Patterns

### 3.1 Workflow Structure
Every workflow should follow a clear structure:
1. **Trigger Node** (Webhook, Cron, or Event-based)
2. **Validation / Transform** (Set, Function, or IF nodes)
3. **Core Logic** (API calls, DB queries, sub-workflows)
4. **Error Handling** (Error Trigger → Slack/Email notification)
5. **Response / Completion** (Respond to Webhook or log result)

### 3.2 Sub-Workflow Pattern
For complex logic, use the "Execute Workflow" node to call reusable sub-workflows:
- **Parent Workflow:** Handles triggers and orchestration.
- **Child Workflow:** Handles a single responsibility (e.g., "Send Invoice Email", "Sync CRM Contact").

### 3.3 Error Handling
Always include a global Error Trigger workflow:
1. Add an **Error Trigger** node.
2. Connect it to a **Slack** or **Email** node to notify the team.
3. Include the `{{ $json.execution.id }}` and `{{ $json.workflow.name }}` in the message for debugging.

### 3.4 Idempotency
When processing webhooks or events, ensure your workflow is idempotent:
- Use a "Function" node to check if the record has already been processed (e.g., by checking a `processed_at` field in the database).
- Use `IF` nodes to skip duplicate events.

### 3.5 Rate Limiting
When calling external APIs, respect rate limits:
- Use the **SplitInBatches** node to process items in groups.
- Add a **Wait** node (e.g., 1 second) between batches.