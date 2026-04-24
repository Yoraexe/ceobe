const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, 'skills');

const contentMap = {
  // 1. COST REDUCER
  'cost-reducer/cloud-and-infra.md': `
# CLOUD & INFRASTRUCTURE COST SAVINGS
1. **Right-Sizing:** Never default to large instances. Start small (e.g., t3.micro/nano) and scale based on metrics.
2. **Spot Instances:** Use pre-emptible/spot instances for background workers or stateless tasks.
3. **Data Transfer:** Avoid cross-zone data transfer. Keep DB and App in the same AZ. Use Cloudflare to cache egress.
`,
  'cost-reducer/code-level-savings.md': `
# CODE LEVEL SAVINGS
1. **Algorithmic Efficiency:** O(N^2) code costs actual dollars in server time. Optimize loops and DB queries.
2. **Memory Leaks:** Unbounded arrays or unclosed connections lead to OOM errors and bloated instances. Always clean up.
3. **Payload Size:** Compress API responses (gzip/brotli). Only send the fields the client actually needs (GraphQL or selective REST).
`,
  'cost-reducer/services-and-finops.md': `
# SERVICES & FINOPS
1. **Managed vs Unmanaged:** Managed DBs (RDS) are expensive but save DevOps time. Choose wisely.
2. **Monitoring Logs:** Excessive logging (debug level in prod) will skyrocket CloudWatch/Datadog bills. Log only warnings and errors in production.
`,
  'cost-reducer/serverless-optimization.md': `
# SERVERLESS OPTIMIZATION (Lambda/Cloudflare Workers)
1. **Cold Starts:** Keep dependencies absolutely minimal. Do not import heavy libraries like full \`lodash\` or \`aws-sdk\` if you only need one function.
2. **Execution Time:** You are billed by the millisecond. Await DB calls concurrently using \`Promise.all()\` whenever possible.
`,
  'cost-reducer/SKILL.md': `---
name: cost-reducer
description: Principles for writing software that is highly economical to run and scale.
---
# COST REDUCER
Always consider the financial impact of your code. Avoid bloated dependencies, unnecessary API calls, and inefficient loops.
`,

  // 2. N8N
  'n8n/api-reference.md': `
# N8N API REFERENCE
When interacting with the n8n REST API to trigger webhooks manually, ensure you pass the correct headers and authentication tokens as defined in the environment.
`,
  'n8n/custom-nodes-reference.md': `
# CUSTOM NODES
1. **Declarative Style:** n8n nodes are built declaratively. Use \`INodeType\` interface.
2. **Operations & Properties:** Define operations clearly in the \`properties\` array. Use \`displayOptions\` to hide/show fields dynamically.
`,
  'n8n/workflow-reference.md': `
# WORKFLOW BEST PRACTICES
1. **Error Handling:** Always attach an Error Trigger node to catch workflow failures.
2. **Pagination:** When fetching third-party APIs inside n8n HTTP Request nodes, ensure pagination is handled to avoid silent data truncation.
`,
  'n8n/auth-nodes-reference.md': `
# N8N AUTH CREDENTIALS
1. Implement \`ICredentialType\` for custom services.
2. Never hardcode secrets. Always map them using n8n's credential object mapping.
`,
  'n8n/SKILL.md': `---
name: n8n
description: Guidelines for operating and extending the n8n workflow automation platform.
---
# N8N SKILL
Focus on resilient workflow design, catching errors gracefully, and mapping credentials securely.
`,

  // 3. SCALABILITY
  'scalability/api-and-services.md': `
# API & SERVICES SCALING
1. **Stateless First:** APIs must be 100% stateless. Do not store session data in the Node.js process.
2. **Circuit Breakers:** If an external service is down, fail fast using circuit breaker patterns.
`,
  'scalability/caching-and-queues.md': `
# CACHING & QUEUES
1. **Redis:** Use Redis for heavily read, infrequently updated data. Always set a TTL (Time-To-Live).
2. **Message Queues:** Offload slow operations (email, PDF generation) to RabbitMQ or SQS. Never block the main HTTP thread.
`,
  'scalability/database-scaling.md': `
# DATABASE SCALING
1. **Indexes:** Every query MUST hit an index. Avoid full table scans.
2. **Read Replicas:** Route heavy GET requests to read-only replicas to free up the primary writer node.
3. **Connection Pooling:** Always use a connection pool (e.g., PgBouncer). Never open a new DB connection per request.
`,
  'scalability/infrastructure.md': `
# INFRASTRUCTURE SCALING
1. **Auto-scaling:** Rely on CPU or Memory thresholds to spin up new pods (Kubernetes HPA) or instances.
2. **Load Balancing:** Use reverse proxies (Nginx/HAProxy) or Cloud Load Balancers to distribute traffic evenly.
`,
  'scalability/state-management.md': `
# DISTRIBUTED STATE
Do not use \`MemoryStore\` in production. Use Redis for cross-instance state synchronization, WebSockets pub/sub, and session management.
`,
  'scalability/SKILL.md': `---
name: scalability
description: Principles for designing systems capable of handling 10x to 1000x traffic spikes.
---
# SCALABILITY SKILL
Design systems anticipating failure. Assume servers will die, DBs will lock, and traffic will spike. Build distributed, stateless applications.
`,

  // 4. SECURITY
  'security/auth-and-secrets.md': `
# AUTH & SECRETS
1. Never commit \`.env\` files or hardcode API keys.
2. Hash passwords with bcrypt or Argon2. NEVER store plain text.
3. Keep JWT lifespans short (e.g., 15 mins) and use long-lived Refresh Tokens stored in HttpOnly cookies.
`,
  'security/database-and-deps.md': `
# DATABASE & DEPENDENCIES
1. **SQL Injection:** ALWAYS use parameterized queries or trusted ORMs. Never concatenate strings into SQL statements.
2. **Deps:** Audit packages regularly (\`npm audit\`). Do not install obscure unmaintained libraries.
`,
  'security/api-security.md': `
# API SECURITY
1. **Rate Limiting:** Protect all endpoints, especially login/OTP, against brute-forcing (e.g., max 5 requests/min).
2. **CORS:** Strictly configure CORS origins. Never use \`Access-Control-Allow-Origin: *\` in production with credentials.
`,
  'security/web-security.md': `
# WEB SECURITY
1. **XSS Protection:** Sanitize all user inputs before rendering them on the frontend.
2. **Headers:** Always use Helmet.js in Express to set strict security headers (CSP, HSTS).
`,
  'security/SKILL.md': `---
name: security
description: Mandatory security practices to prevent XSS, Injection, and unauthorized access.
---
# SECURITY SKILL
Trust no input. Assume the client is compromised. Sanitize everything and adhere to OWASP Top 10 guidelines.
`,

  // 5. FRONTEND DESIGN
  'frontend-design/modern-aesthetics.md': `
# MODERN AESTHETICS
1. **No Default Colors:** Never use primary Blue #0000FF. Use tailored HSL palettes (e.g., Slate, Zinc, Indigo from Tailwind).
2. **Typography:** Use Inter, Roboto, or Outfit. Rely on tracking and line-height for readability.
3. **Glassmorphism:** Use subtle \`backdrop-blur\` for modals and navbars.
4. **Dark Mode:** Support dark mode inherently using neutral dark grays (not pure black #000000).
`,
  'frontend-design/component-patterns.md': `
# COMPONENT PATTERNS
1. **Atomic Design:** Build small, reusable, single-responsibility components (Buttons, Inputs).
2. **Headless UI:** Prefer unstyled logic (like Radix UI or headless UI) and paint it with Tailwind CSS.
`,
  'frontend-design/state-and-routing.md': `
# STATE & ROUTING
1. Keep global state minimal. Use React Query / SWR for server state, and local \`useState\` for UI state.
2. Implement route-level code splitting to keep the initial JS bundle ultra-small.
`,
  'frontend-design/SKILL.md': `---
name: frontend-design
description: Guidelines for creating premium, stunning, and highly responsive user interfaces.
---
# FRONTEND DESIGN SKILL
The user must be WOW'ed. Interfaces must feel premium, alive (micro-animations), and highly polished. Do not output raw 2010s HTML/CSS.
`,

  // 6. CREATE SKILL
  'create-skill/examples.md': `
# SKILL CREATION EXAMPLES
Always structure a skill with a primary \`SKILL.md\` that has frontmatter (name, description), and supporting \`.md\` files containing context.
`,
  'create-skill/reference.md': `
# REFERENCE
A skill is a modular domain of knowledge. It must be specific, actionable, and focus on absolute constraints ("Never do X. Always do Y").
`,
  'create-skill/SKILL.md': `---
name: create-skill
description: Meta-skill describing how the AI should generate new skills for itself.
---
# CREATE SKILL
When asked to learn something new permanently, generate a new folder in the \`skills/\` directory with highly structured markdown files detailing best practices, avoiding fluff.
`,

  // 7. RESEARCHER
  'researcher/search-techniques.md': `
# SEARCH TECHNIQUES
1. Do not hallucinate package methods. Use \`curl\` or web search tools to read official documentation.
2. When searching, prioritize official domains (e.g., \`site:developer.mozilla.org\` or \`site:docs.n8n.io\`).
`,
  'researcher/synthesis-format.md': `
# SYNTHESIS
When summarizing research, provide:
1. The Problem
2. The Solution / API Signature
3. Direct Code Example
Do not include long narrative explanations. Keep it technical and concise.
`,
  'researcher/SKILL.md': `---
name: researcher
description: Methods for searching, verifying, and synthesizing technical documentation.
---
# RESEARCHER SKILL
You are a senior analyst. Read documentation thoroughly before writing code for an unknown or updated library. Output dense, factual summaries.
`,

  // 8. CUSTOMER SUPPORT
  'customer-support/escalation-guide.md': `
# ESCALATION
If a user issue involves data loss, severe security breaches, or aggressive legal threats, instantly escalate the ticket to a human manager. Do not attempt to resolve.
`,
  'customer-support/response-templates.md': `
# RESPONSE TEMPLATES
1. Acknowledge the problem factually without emotional groveling.
2. Provide a clear timeline or immediate workaround.
3. Be concise. Never blame internal teams.
`,
  'customer-support/SKILL.md': `---
name: customer-support
description: Tone and protocols for interacting with end-users or clients.
---
# CUSTOMER SUPPORT SKILL
Emulate a professional, highly capable tier-3 technical support engineer. Be empathetic, objective, and strictly factual.
`,

  // 9. KNOW ME
  'know-me/memory-operations.md': `
# MEMORY OPERATIONS
When detecting a user preference, save it to a local \`memory.json\` file at the workspace root so it persists across sessions. Structure it strictly as key-value pairs.
`,
  'know-me/what-to-track.md': `
# WHAT TO TRACK
Track:
- Preferred programming languages & frameworks (e.g., React vs Vue).
- Tab vs Space preferences.
- Tone preferences (Chatty vs Concise).
- Architectural biases (e.g., hates ORMs, loves raw SQL).
`,
  'know-me/SKILL.md': `---
name: know-me
description: Systems for tracking and persisting user preferences to build a tailored AI persona.
---
# KNOW ME SKILL
The AI must adapt to the user's specific workflow. Detect frustrations, note coding styles, and never make the user repeat their preferences.
`,

  // 10. TRIGGER DEV
  'trigger-dev/advanced-reference.md': `
# TRIGGER.DEV ADVANCED
1. **Idempotency:** Background jobs retry on failure. Ensure your database queries and logic inside \`trigger.dev\` tasks are idempotent (running them twice doesn't duplicate data).
2. **Resumes:** Use \`wait\` functionalities to pause execution without taking up compute execution limits.
`,
  'trigger-dev/config-reference.md': `
# TRIGGER.DEV CONFIG
Ensure \`trigger.config.ts\` is strictly typed and exports the correct \`project\` ID. Lock backend keys dynamically via environment variables.
`,
  'trigger-dev/core-reference.md': `
# TRIGGER.DEV CORE (v3)
In v3, tasks are pure async functions wrapped in \`task()\`. There are no more convoluted Job class structures. Pass serializable JSON only.
`,
  'trigger-dev/SKILL.md': `---
name: trigger-dev
description: Best practices for background jobs and cron executions using Trigger.dev v3.
---
# TRIGGER.DEV SKILL
Write highly resilient background tasks. Assume tasks will fail and retry. Guarantee idempotency in your code.
`,

  // 11. SELF HEALING
  'self-healing/memory-management.md': `
# DIAGNOSTIC MEMORY
When encountering an error, store the stack trace snippet and the attempted fix in temporary memory. If the same error appears again, DO NOT try the exact same fix.
`,
  'self-healing/pattern-recognition.md': `
# PATTERN RECOGNITION
Recognize classic issues:
- "EADDRINUSE": Port is taken. Kill the process.
- "Cannot read property of undefined": Missing optional chaining or null checks.
- "SyntaxError": Read the last file modified.
`,
  'self-healing/diagnostic-techniques.md': `
# DIAGNOSTIC TECHNIQUES
1. Never blindly replace an entire file. Read the specific lines mentioned in the error log.
2. Use tools to check running processes or memory limits.
3. If an NPM install fails, clear the cache or check Node versions.
`,
  'self-healing/SKILL.md': `---
name: self-healing
description: The cognitive loop for autonomic debugging and error resolution.
---
# SELF HEALING SKILL
Do not panic when encountering errors. Act methodically. Read logs, isolate the failing component, test a hypothesis, and iterate.
`
};

Object.keys(contentMap).forEach(relativePath => {
  const absolutePath = path.join(skillsDir, relativePath);
  try {
    fs.writeFileSync(absolutePath, contentMap[relativePath].trim(), 'utf8');
    console.log('Populated:', relativePath);
  } catch (err) {
    console.error('Error writing', relativePath, err);
  }
});

console.log('All skills populated successfully!');
