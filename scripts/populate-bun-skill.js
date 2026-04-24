const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, 'skills');

const contentMap = {
  // 15. BUN DEVELOPER
  'bun-developer/package-management.md': `
# PACKAGE MANAGEMENT
1. **Never Use NPM:** When this skill is active, NEVER run \`npm install\`, \`npm run\`, or \`npx\`.
2. **Always Use Bun:** Always use \`bun install\`, \`bun add\`, \`bun run\`, and \`bunx\`.
3. **Lockfile:** Rely on \`bun.lockb\`. Do not generate or interact with \`package-lock.json\`.
`,
  'bun-developer/runtime-features.md': `
# NATIVE RUNTIME FEATURES
1. **File I/O:** Prefer native \`Bun.file()\` and \`Bun.write()\` over Node's \`fs/promises\` where applicable.
2. **HTTP Server:** For lightweight wrappers, use \`Bun.serve()\` directly instead of installing raw Express.
3. **Framework Choice:** When building APIs, DEFAULT to **Elysia.js** or **Hono.js**. They are optimized for the Bun runtime.
`,
  'bun-developer/testing.md': `
# TESTING
1. **Never Install Jest:** Do not install Jest or Vitest unless explicitly required by a framework like Nuxt.
2. **Native Test Runner:** Always use the built-in \`bun test\`. Write standard \`test()\` and \`expect()\` assertions natively from \`bun:test\`.
`,
  'bun-developer/SKILL.md': `---
name: bun-developer
description: Strict guidelines for writing ultra-fast TypeScript applications natively using the Bun runtime.
---
# BUN DEVELOPER SKILL
You are a modern JavaScript architect. When this skill is active, you absolutely reject legacy Node.js/NPM habits. Everything must be executed, tested, and resolved via Bun.
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

console.log('Bun skill populated successfully!');
