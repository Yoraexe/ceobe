---
name: create-skill
description: Meta-skill for creating new Ceobe skill modules with proper structure and conventions.
---
# CREATE-SKILL (Meta-Skill for Authoring New Skills)

## 1. Core Philosophy
Skills are Ceobe's specialized knowledge modules. When creating a new skill, follow strict structural conventions so the Skill Router can correctly load and inject them into prompts.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never create a skill without a `SKILL.md` file containing frontmatter (`name`, `description`).
- ❌ Never write vague one-liner instructions. Every skill must contain concrete code examples or configuration patterns.
- ❌ Never duplicate knowledge already covered by another skill. Check existing skills first.

## 3. Skill Directory Structure
Every skill lives in `/skills/<skill-name>/` and must contain:

```
skills/
└── my-new-skill/
    ├── SKILL.md              # Required: Primary skill file with frontmatter
    ├── patterns.md           # Optional: Common code patterns and snippets
    ├── anti-patterns.md      # Optional: What to avoid
    └── config-reference.md   # Optional: Configuration reference
```

## 4. SKILL.md Template

```markdown
---
name: my-new-skill
description: A one-line description of what this skill provides.
---
# MY NEW SKILL

## 1. Core Philosophy
(2-3 sentences about the mindset and purpose)

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never do X because Y.
- ❌ Never do A because B.

## 3. Practical Patterns

### 3.1 Pattern Name
(Description + code example)

### 3.2 Another Pattern
(Description + code example)
```

## 5. Quality Checklist
Before committing a new skill:
- [ ] `SKILL.md` has valid YAML frontmatter with `name` and `description`.
- [ ] Contains at least 3 anti-patterns in the Constraints section.
- [ ] Contains at least 2 code examples in the Practical Patterns section.
- [ ] Total file length is ≥ 30 lines.
- [ ] Does not duplicate content from existing skills.