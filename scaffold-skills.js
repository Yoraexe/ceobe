const fs = require('fs');
const path = require('path');

const skillsDir = path.join(__dirname, 'skills');

const skills = [
  {
    name: 'cost-reducer',
    files: ['cloud-and-infra.md', 'code-level-savings.md', 'services-and-finops.md', 'serverless-optimization.md', 'SKILL.md']
  },
  {
    name: 'n8n',
    files: ['api-reference.md', 'custom-nodes-reference.md', 'workflow-reference.md', 'auth-nodes-reference.md', 'SKILL.md']
  },
  {
    name: 'scalability',
    files: ['api-and-services.md', 'caching-and-queues.md', 'database-scaling.md', 'infrastructure.md', 'state-management.md', 'SKILL.md']
  },
  {
    name: 'security',
    files: ['auth-and-secrets.md', 'database-and-deps.md', 'api-security.md', 'web-security.md', 'SKILL.md']
  },
  {
    name: 'frontend-design',
    files: ['modern-aesthetics.md', 'component-patterns.md', 'state-and-routing.md', 'SKILL.md']
  },
  {
    name: 'create-skill',
    files: ['examples.md', 'reference.md', 'SKILL.md']
  },
  {
    name: 'researcher',
    files: ['search-techniques.md', 'synthesis-format.md', 'SKILL.md']
  },
  {
    name: 'customer-support',
    files: ['escalation-guide.md', 'response-templates.md', 'SKILL.md']
  },
  {
    name: 'know-me',
    files: ['memory-operations.md', 'what-to-track.md', 'SKILL.md']
  },
  {
    name: 'trigger-dev',
    files: ['advanced-reference.md', 'config-reference.md', 'core-reference.md', 'SKILL.md']
  },
  {
    name: 'self-healing',
    files: ['memory-management.md', 'pattern-recognition.md', 'diagnostic-techniques.md', 'SKILL.md']
  }
];

if (!fs.existsSync(skillsDir)) {
  fs.mkdirSync(skillsDir, { recursive: true });
}

skills.forEach(skill => {
  const skillPath = path.join(skillsDir, skill.name);
  if (!fs.existsSync(skillPath)) {
    fs.mkdirSync(skillPath);
  }

  skill.files.forEach(file => {
    const filePath = path.join(skillPath, file);
    if (!fs.existsSync(filePath)) {
      let content = `# ${file.replace('.md', '').toUpperCase()}\n\n`;
      if (file === 'SKILL.md') {
        content = `---
name: ${skill.name}
description: Definition and rules for the ${skill.name} skill.
---

# ${skill.name.toUpperCase()} SKILL

This skill dictates how Ceobe should handle tasks related to ${skill.name}.
`;
      }
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Created: ${filePath}`);
    }
  });
});

console.log('Skill scaffolding complete!');
