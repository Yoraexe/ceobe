import { readTemplate, readCeobeRules, readSpecificSkills, getAvailableSkills } from '../../utils/contextLoader';

export function buildSkillRouterPrompt(taskDescription: string): string {
  const availableSkills = getAvailableSkills();
  return `You are the Ceobe AI Skill Router.
Your ONLY job is to analyze the user request and determine which internal skills are required.

Available Skills:
${availableSkills.join(', ')}

User Request:
${taskDescription}

Output ONLY a raw, comma-separated list of the exact skill names required. If none apply, output "none".
Example: "cost-reducer, scalability, frontend-design"
NO markdown, NO greetings, NO extra text.`;
}

import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir } from '../../utils/context';

function extractADRSection(): string {
  try {
    const archPath = path.join(getProjectDir(), '.ceobe', 'architecture.md');
    if (!fs.existsSync(archPath)) return '';
    const content = fs.readFileSync(archPath, 'utf8');
    const adrMatch = content.match(/## 8\. Key Design Decisions \(ADR\)([\s\S]*)/);
    return adrMatch ? adrMatch[1].trim() : '';
  } catch {
    return '';
  }
}

function assembleBaseContext(rules: string, skillsContext: string, auditorFeedback?: string): string {
  let ctx = '';
  if (rules) ctx += `Adhere to these rules:\n${rules}\n`;
  if (skillsContext) ctx += `\n${skillsContext}\n`;
  
  const adrs = extractADRSection();
  if (adrs) ctx += `\nARCHITECTURE DECISIONS (DO NOT CONTRADICT):\n${adrs}\n`;
  
  if (auditorFeedback) ctx += `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n`;
  return ctx;
}

function getCriticalConstraintEcho(): string {
  return `\n--- CRITICAL REMINDERS (RE-READ) ---
1. NEVER hallucinate imports — verify package.json first (Rule #13)
2. ALWAYS respect existing project patterns — Adaptive Legacy Fallback (Rule #1)
3. ALWAYS add file header documentation (Rule #14)
4. NEVER put business logic in controllers (Rule #3)
5. VERIFY file existence before editing (Rule #13)
--- END REMINDERS ---`;
}

export function buildBRDPrompt(taskDescription: string, selectedSkills: string[] = [], auditorFeedback?: string): string {
  const rules = readCeobeRules();
  const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
  const context = assembleBaseContext(rules, skillsContext, auditorFeedback);
  
  return `You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 1: DISCOVERY & BRD.

${context}

User Input (Description, Image, or External Document):
${taskDescription}

Your Job:
1. If the input is a short description or an IMAGE (like a UI mockup), generate a full BRD.
2. If it's an image, analyze the visual structure, components, and UX flow to define the requirements.
3. If the input is an existing document, STANDARDIZE it.
4. Fill any gaps using your senior engineering expertise.

Output ONLY the markdown Business Requirements Document (BRD).

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('brd-template.md')}

${getCriticalConstraintEcho()}`;
}

export function buildDesignPrompt(brdContent: string, selectedSkills: string[] = [], auditorFeedback?: string): string {
  const rules = readCeobeRules();
  const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
  const context = assembleBaseContext(rules, skillsContext, auditorFeedback);
  
  return `You are the Design Lead of the Ceobe AI Engineering System.
STAGE 1.5: UI/UX & DESIGN SYSTEM.

${context}

Current BRD Context:
${brdContent}

Output ONLY the markdown Design Specification based on the BRD. Outline the color palette, typography, core components, and screen layouts. Do not write full code.

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('design-template.md')}

${getCriticalConstraintEcho()}`;
}

export function buildArchitecturePrompt(brdContent: string, designContent: string, selectedSkills: string[] = [], auditorFeedback?: string): string {
  const rules = readCeobeRules();
  const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
  const context = assembleBaseContext(rules, skillsContext, auditorFeedback);
  
  return `You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 2: ARCHITECTURE DESIGN.

${context}

Current BRD Context:
${brdContent}

Current Design Context:
${designContent}

Output ONLY the markdown Architecture Document. Outline the tech stack, data schemas, and folder structures. Do not write full code.

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('architecture-template.md')}

${getCriticalConstraintEcho()}`;
}

export function buildImplementationPrompt(architectureContent: string, selectedSkills: string[] = [], auditorFeedback?: string): string {
  const rules = readCeobeRules();
  const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
  const context = assembleBaseContext(rules, skillsContext, auditorFeedback);
  
  return `You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 3: EXECUTION CHECKLIST (JSON).

${context}

Current Architecture Context:
${architectureContent}

Your ONLY task is to output a raw JSON array. DO NOT use markdown code blocks (\`\`\`json). DO NOT output any conversational text.
ONLY output a valid JSON array of strings, where each string is an actionable, sequential technical task for an AI coder to execute.
Ensure tasks can be executed sequentially or in independent groups. Be very specific (e.g., "Create src/index.ts with Express boilerplate", "Configure vitest in vitest.config.ts").

Example Output:
[
  "Initialize package.json with necessary dependencies (express, cors, dotenv)",
  "Create src/index.ts setting up the Express server and port listener",
  "Implement src/utils/logger.ts using winston"
]

${getCriticalConstraintEcho()}`;
}

export function buildDevOpsPrompt(architectureContent: string, selectedSkills: string[] = [], auditorFeedback?: string): string {
  const rules = readCeobeRules();
  const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
  const context = assembleBaseContext(rules, skillsContext, auditorFeedback);

  return `You are the DevOps Engineer of the Ceobe AI Engineering System.
STAGE 4: DEVOPS CONFIGURATION.

${context}

Current Architecture Context:
${architectureContent}

Output ONLY the markdown DevOps Configuration (Dockerfile, CI/CD YAML, docker-compose).

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('devops-template.md')}

${getCriticalConstraintEcho()}`;
}

export function buildAuditPrompt(brdContent: string, designContent: string, archContent: string, executionPlan: string, devopsConfig: string): string {
  const rules = readCeobeRules();
  return `You are the QA Auditor of the Ceobe AI Engineering System.
Your job is to strictly evaluate the proposed plan against the system rules and consistency requirements.

Rules to enforce:
${rules}

--- PLAN DOCUMENTS ---
BRD:
${brdContent}

Design Spec:
${designContent}

Architecture:
${archContent}

Execution Checklist:
${executionPlan}

DevOps Configuration:
${devopsConfig}

Evaluate the plan. If there are contradictions, missing safety nets, skipped tests, or missing Docker configurations, you MUST reject the plan.
If the plan is perfect, you must output EXACTLY "APPROVE".
If the plan has issues, you must output a list of SPECIFIC feedback points that the Planner needs to fix. Do not write "REJECT", just write the feedback.`;
}
