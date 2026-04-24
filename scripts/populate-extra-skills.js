const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, 'skills');

const contentMap = {
  // 12. DATABASE ARCHITECT
  'database-architect/normalization-rules.md': `
# NORMALIZATION
1. **Third Normal Form (3NF):** Always strive for 3NF. Do not duplicate data unless there is a proven, measured performance bottleneck that requires denormalization.
2. **UUIDs:** Always use UUIDv4 or ULID for primary keys exposed to the client to prevent sequential ID guessing. Let the database generate them if possible (e.g., \`gen_random_uuid()\`).
`,
  'database-architect/migration-best-practices.md': `
# MIGRATIONS
1. **Immutable History:** Never rewrite a migration that has already been executed in production. Always write a new migration to alter the state.
2. **Backwards Compatibility:** All database schema changes (adding, renaming, dropping columns) MUST be backward compatible. Deploy the DB change first, then the code.
`,
  'database-architect/index-optimization.md': `
# INDEX OPTIMIZATION
1. **Foreign Keys:** Every foreign key column MUST have a corresponding index to speed up JOIN operations.
2. **Composite Indexes:** Use composite indexes for queries that filter by multiple columns (e.g., \`WHERE status = ? AND created_at > ?\`). Order matters: most selective column first.
`,
  'database-architect/SKILL.md': `---
name: database-architect
description: Rules for designing scalable, normalized, and highly performant relational databases schemas.
---
# DATABASE ARCHITECT SKILL
You design databases that survive massive scale. Prevent data anomalies, enforce strict types, and optimize query paths.
`,

  // 13. TESTING ENGINEER
  'testing-engineer/unit-testing-vitest.md': `
# UNIT TESTING (VITEST)
1. **Isolation:** Functions must be tested in pure isolation. Do not connect to real databases in unit tests.
2. **Edge Cases:** Always write test assertions for the "Sad Path" (null values, empty arrays, invalid arguments). Do not just test the "Happy Path".
`,
  'testing-engineer/e2e-playwright.md': `
# E2E TESTING (PLAYWRIGHT)
1. **Data Seeding:** Reset the database to a known state before E2E suites run. Do not rely on data leftover from previous tests.
2. **Resilience:** Use proper locators (\`getByRole\`, \`getByText\`) instead of brittle CSS selectors or XPaths.
`,
  'testing-engineer/mocking-strategies.md': `
# MOCKING STRATEGIES
1. **External APIs:** NEVER call third-party APIs (Stripe, Twilio) in tests. Use MSW (Mock Service Worker) or Jest/Vitest spy functions to intercept and return fake responses.
2. **Time Dependency:** If a function depends on \`Date.now()\`, mock the system time so assertions don't fail intermittently.
`,
  'testing-engineer/SKILL.md': `---
name: testing-engineer
description: Best practices for writing robust, deterministic Unit, Integration, and E2E tests.
---
# TESTING ENGINEER SKILL
You break code before it reaches production. Write tests that run fast, never flake, and provide absolute confidence.
`,

  // 14. DEPLOYMENT OPS
  'deployment-ops/dockerfile-standards.md': `
# DOCKERFILE STANDARDS
1. **Multi-Stage Builds:** Always use multi-stage builds. Compile TypeScript in a \`builder\` stage, and copy only the \`dist/\` and \`node_modules/ (production only)\` to the final Alpine image.
2. **Non-Root User:** NEVER run Node.js as \`root\` inside the container. Use \`USER node\`.
`,
  'deployment-ops/github-actions-templates.md': `
# GITHUB ACTIONS
1. **Caching:** Always set up dependency caching (\`actions/setup-node\`) to speed up CI pipelines.
2. **Secrets:** Pass production secrets strictly via \`$\{{ secrets.VAR_NAME }}\`. Never echo secrets in bash commands.
`,
  'deployment-ops/monorepo-deployment.md': `
# MONOREPO DEPLOYMENT
In a monorepo (e.g., Turborepo), ensure CI only builds and deploys the packages/apps that actually changed (\`--filter=...\`).
`,
  'deployment-ops/SKILL.md': `---
name: deployment-ops
description: Rules for safe, automated, and containerized Continuous Integration & Continuous Deployment (CI/CD).
---
# DEPLOYMENT OPS SKILL
You are the guardian of the production environment. Output efficient Dockerfiles and secure deployment pipelines.
`
};

Object.keys(contentMap).forEach(relativePath => {
  const absolutePath = path.join(skillsDir, relativePath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  try {
    fs.writeFileSync(absolutePath, contentMap[relativePath].trim(), 'utf8');
    console.log('Populated:', relativePath);
  } catch (err) {
    console.error('Error writing', relativePath, err);
  }
});

console.log('Extra skills populated successfully!');
