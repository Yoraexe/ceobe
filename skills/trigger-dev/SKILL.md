---
name: trigger-dev
description: Patterns and best practices for building reliable background jobs with Trigger.dev.
---
# TRIGGER.DEV SKILL

## 1. Core Philosophy
Trigger.dev is a platform for building reliable background jobs in TypeScript. You write jobs that are durable, observable, and retryable. Treat every job as a critical business process.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never run long-running tasks in API request handlers. Offload them to Trigger.dev jobs.
- ❌ Never store job state in memory. Use Trigger.dev's built-in `io.store` for durable state.
- ❌ Never ignore job failures. Always configure retry policies and dead-letter logging.
- ❌ Never use `setTimeout` for delays inside a job. Use `io.wait()` which survives process restarts.

## 3. Practical Patterns

### 3.1 Defining a Job
```typescript
import { client } from "@/trigger";
import { eventTrigger } from "@trigger.dev/sdk";

client.defineJob({
  id: "process-order",
  name: "Process Order",
  version: "1.0.0",
  trigger: eventTrigger({
    name: "order.created",
  }),
  run: async (payload, io, ctx) => {
    // Step 1: Validate
    const order = await io.runTask("validate-order", async () => {
      return validateOrder(payload);
    });

    // Step 2: Charge payment
    await io.runTask("charge-payment", async () => {
      return chargeStripe(order.paymentIntentId);
    });

    // Step 3: Send confirmation
    await io.runTask("send-email", async () => {
      return sendEmail(order.customerEmail, "Your order is confirmed!");
    });
  },
});
```

### 3.2 Retry Configuration
Always set explicit retry policies:
```typescript
client.defineJob({
  id: "sync-crm",
  name: "Sync CRM",
  version: "1.0.0",
  trigger: eventTrigger({ name: "contact.updated" }),
  // Retry up to 3 times with exponential backoff
  integrations: {},
  run: async (payload, io) => {
    await io.runTask("sync", async () => {
      // This task will be retried automatically on failure
      return syncToCRM(payload);
    }, { retry: { limit: 3, minTimeoutInMs: 1000, factor: 2 } });
  },
});
```

### 3.3 Scheduled Jobs (Cron)
```typescript
import { cronTrigger } from "@trigger.dev/sdk";

client.defineJob({
  id: "daily-report",
  name: "Daily Report",
  version: "1.0.0",
  trigger: cronTrigger({ cron: "0 9 * * *" }), // Every day at 9 AM
  run: async (payload, io) => {
    await io.runTask("generate-report", async () => {
      return generateDailyReport();
    });
  },
});
```

### 3.4 Durable Delays
Use `io.wait()` instead of `setTimeout`:
```typescript
// Wait 30 minutes before sending a follow-up email
await io.wait("wait-for-followup", 30 * 60); // seconds
await io.runTask("send-followup", async () => {
  return sendFollowUpEmail(payload.email);
});
```