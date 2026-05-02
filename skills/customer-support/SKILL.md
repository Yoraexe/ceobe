# Skill: Customer Support System Design

## 1. Metadata
- **Name:** `customer-support`
- **Origin:** `Astesia Core`
- **Description:** Patterns for building customer-facing support systems, including chatbot flows, ticket management, FAQ schemas, and professional communication protocols.

## 2. When to Use
Invoke this skill when:
- Building a help desk, ticketing system, or customer portal.
- Implementing a chatbot or AI-assisted support agent.
- The BRD mentions "customer support," "ticketing," "FAQ," or "live chat."

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never expose internal error messages or stack traces to end users.
- ❌ Never auto-close tickets without user confirmation.
- ❌ Never store unencrypted PII (personally identifiable information).
- ❌ Never send automated responses that feel robotic — maintain a warm, professional tone.

## 4. Practical Patterns

### Ticket Data Model
```typescript
// Database schema for a support ticket system
const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  // status: 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'closed'
  priority: varchar('priority', { length: 10 }).default('medium').notNull(),
  // priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo: integer('assigned_to').references(() => agents.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

const ticketMessages = pgTable('ticket_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').references(() => tickets.id).notNull(),
  senderId: integer('sender_id').notNull(),
  senderType: varchar('sender_type', { length: 10 }).notNull(), // 'user' | 'agent' | 'bot'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### FAQ Schema (Structured for AI Search)
```typescript
const faqs = pgTable('faqs', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  keywords: text('keywords'), // Comma-separated for search
  helpfulness: integer('helpfulness').default(0), // User vote count
  createdAt: timestamp('created_at').defaultNow(),
});
```

### AI-Assisted Response Generation
```typescript
// Use LLM to draft a response, but always flag for human review
async function generateSupportDraft(ticket: Ticket, faqContext: string): Promise<string> {
  const prompt = `
You are a professional support agent. Draft a response for this ticket.
Tone: Warm, professional, solution-oriented.

Customer Issue: ${ticket.description}

Relevant FAQ Context:
${faqContext}

Rules:
- Address the customer by name if available.
- Be specific about next steps.
- If unsure, escalate to a human agent.
  `;

  const response = await llm.generate(prompt);
  return response.text;
}
```

### Communication Tone Guidelines
| Scenario | Tone | Example |
|:---------|:-----|:--------|
| Greeting | Warm, professional | "Hi [Name], thanks for reaching out! Let me help you with that." |
| Acknowledging issue | Empathetic | "I understand how frustrating this must be. Let's get it resolved." |
| Providing solution | Clear, actionable | "Here's what you can do: 1. Go to Settings → ... 2. Click ..." |
| Escalating | Transparent | "I'm going to bring in a specialist who can help you further." |
| Closing | Positive | "Glad we could sort this out! Don't hesitate to reach out again." |

## 5. Implementation Checklist
- [ ] Ticket CRUD endpoints with proper status transitions
- [ ] Real-time updates via WebSocket or SSE for active tickets
- [ ] FAQ search with keyword matching and/or semantic search
- [ ] AI draft generation with human review flag
- [ ] SLA tracking (first response time, resolution time)
- [ ] PII fields encrypted at rest