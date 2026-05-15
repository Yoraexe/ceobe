// Module: src/ai/planner.ts
// Purpose: Orchestrates all planning phases (BRD, Design, Architecture, Tasks, DevOps, Audit).
//          Provider-agnostic: uses createPlannerAdapter() for all planning phases.
//          The AUDIT phase uses a DEDICATED 'qa' role adapter to prevent self-evaluation bias.
// Caller: src/index.ts, src/ai/supervisor.ts
// Dependencies: providers/router, contextLoader, chalk, ora
// Side Effects: HTTP requests to the configured planner AND qa AI providers

import { createProviderAdapter } from './providers/router';
import chalk from 'chalk';
import ora from 'ora';
import { readCeobeRules, readTemplate, getAvailableSkills, readSpecificSkills } from '../utils/contextLoader';
import type { NormalizedContentBlock } from './providers/types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — gets a ready-to-use planner adapter and its display name
// ─────────────────────────────────────────────────────────────────────────────
function getPlanner() {
  const adapter = createProviderAdapter('planner');
  const tag = `[${adapter.name.toUpperCase()} / ${adapter.modelId}]`;
  return { adapter, tag };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — gets a ready-to-use QA auditor adapter and its display name
// Uses 'qa' role which resolves: CEOBE_QA_PROVIDER → fallback CEOBE_PLANNER_PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
function getQaAuditor() {
  const adapter = createProviderAdapter('qa');
  const tag = `[QA: ${adapter.name.toUpperCase()} / ${adapter.modelId}]`;
  return { adapter, tag };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 0 — SKILL CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export async function selectRelevantSkills(taskDescription: string | NormalizedContentBlock[]): Promise<string[]> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Analyzing required skills...`).start();

  try {
    const availableSkills = getAvailableSkills();
    if (availableSkills.length === 0) {
      spinner.succeed('No skills found. Proceeding without skills.');
      return [];
    }

    const prompt: string | any[] = typeof taskDescription === 'string'
      ? `
You are the Ceobe AI Skill Router.
Your ONLY job is to analyze the user request and determine which internal skills are required.

Available Skills:
${availableSkills.join(', ')}

User Request:
${taskDescription}

Output ONLY a raw, comma-separated list of the exact skill names required. If none apply, output "none".
Example: "cost-reducer, scalability, frontend-design"
NO markdown, NO greetings, NO extra text.
`
      : [
          { type: 'text', text: `You are the Ceobe AI Skill Router. Analyze the text and image to determine required skills.\nAvailable Skills: ${availableSkills.join(', ')}\nOutput ONLY a raw, comma-separated list.` },
          ...taskDescription
        ];

    const output = await adapter.generate(prompt, 0.0);
    if (output.toLowerCase() === 'none') {
      spinner.succeed(chalk.green(`${tag} No specific skills selected.`));
      return [];
    }

    const selected = output.split(',').map(s => s.trim()).filter(s => availableSkills.includes(s));
    spinner.succeed(chalk.green(`${tag} Skills selected: ${selected.join(', ')}`));
    return selected;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to route skills. Proceeding with base rules only. Reason: ${msg}`));
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — BRD
// ─────────────────────────────────────────────────────────────────────────────
export async function generateBRD(
  taskDescription: string | NormalizedContentBlock[],
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating Business Requirements Document...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const basePrompt = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 1: DISCOVERY & BRD.

Adhere to these rules:
${rules}

${skillsContext}

User Input (Description, Image, or External Document):
${typeof taskDescription === 'string' ? taskDescription : '(See attached image/blocks for input)'}

Your Job:
1. If the input is a short description or an IMAGE (like a UI mockup), generate a full BRD.
2. If it's an image, analyze the visual structure, components, and UX flow to define the requirements.
3. If the input is an existing document, STANDARDIZE it.
4. Fill any gaps using your senior engineering expertise.

Output ONLY the markdown Business Requirements Document (BRD).

${auditorFeedback ? `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n` : ''}

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('brd-template.md')}
`;

    const prompt: string | any[] = typeof taskDescription === 'string'
      ? basePrompt
      : [
          { type: 'text', text: basePrompt },
          ...taskDescription
        ];

    const result = await adapter.generate(prompt, 0.2);
    spinner.succeed(chalk.green(`${tag} BRD generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate BRD. Reason: ${msg}`));
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1.5 — DESIGN SPEC
// ─────────────────────────────────────────────────────────────────────────────
export async function generateDesignSpec(
  brdContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Designing UI/UX & Design System...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const prompt = `
You are the Design Lead of the Ceobe AI Engineering System.
STAGE 1.5: UI/UX & DESIGN SYSTEM.

Rules:
${rules}

${skillsContext}

Current BRD Context:
${brdContent}

Output ONLY the markdown Design Specification based on the BRD. Outline the color palette, typography, core components, and screen layouts. Do not write full code.

${auditorFeedback ? `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n` : ''}

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('design-template.md')}
`;

    const result = await adapter.generate(prompt, 0.3);
    spinner.succeed(chalk.green(`${tag} Design Spec generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Design Spec. Reason: ${msg}`));
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — ARCHITECTURE
// ─────────────────────────────────────────────────────────────────────────────
export async function generateArchitecture(
  brdContent: string,
  designContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Designing System Architecture...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const prompt = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 2: ARCHITECTURE DESIGN.

Rules:
${rules}

${skillsContext}

Current BRD Context:
${brdContent}

Current Design Context:
${designContent}

Output ONLY the markdown Architecture Document. Outline the tech stack, data schemas, and folder structures. Do not write full code.

${auditorFeedback ? `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n` : ''}

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('architecture-template.md')}
`;

    const result = await adapter.generate(prompt, 0.2);
    spinner.succeed(chalk.green(`${tag} Architecture Plan generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Architecture Plan. Reason: ${msg}`));
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — IMPLEMENTATION PLAN
// ─────────────────────────────────────────────────────────────────────────────
export async function generateImplementationPlan(
  architectureContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating Execution Checklist...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const prompt = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 3: IMPLEMENTATION / SPRINT PLANNING.

Rules:
${rules}

${skillsContext}

Current Architecture Plan Context:
${architectureContent}

Output ONLY the markdown execution checklist (a Jira-like task list). Detail what file paths to create/edit and exactly what code the Executor AI should write in each file.

${auditorFeedback ? `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n` : ''}

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('tasks-template.md')}
`;

    const result = await adapter.generate(prompt, 0.2);
    spinner.succeed(chalk.green(`${tag} Execution Checklist generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Checklist. Reason: ${msg}`));
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — DEVOPS
// ─────────────────────────────────────────────────────────────────────────────
export async function generateDevOpsConfig(
  architectureContent: string,
  taskContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating DevOps & Deployment Config...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const prompt = `
You are the DevOps Lead of the Ceobe AI Engineering System.
STAGE 5: DEVOPS & INFRASTRUCTURE.

Rules:
${rules}

${skillsContext}

Current Architecture Plan Context:
${architectureContent}

Current Task Plan Context:
${taskContent}

Output ONLY the markdown DevOps Specification. Outline environment variables, Docker config, CI/CD pipeline, and production readiness checklist. Do not write full code.

${auditorFeedback ? `\nIMPORTANT FEEDBACK FROM AUDITOR:\n${auditorFeedback}\n` : ''}

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('devops-template.md')}
`;

    const result = await adapter.generate(prompt, 0.2);
    spinner.succeed(chalk.green(`${tag} DevOps Spec generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate DevOps Spec. Reason: ${msg}`));
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — AUDIT  (uses independent 'qa' role, NOT planner)
// ─────────────────────────────────────────────────────────────────────────────
export async function auditPlan(
  combinedContent: string,
  selectedSkills: string[] = []
): Promise<{ passed: boolean; feedback?: string }> {
  // ⚠️  CRITICAL: Always use the QA auditor, NOT the planner.
  // The model that designed the plans must NOT also be the one validating them.
  const { adapter, tag } = getQaAuditor();
  const spinner = ora(`${tag} Auditing project plans for conflicts and rule violations...`).start();

  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';

    const prompt = `
You are the Lead Quality Assurance Auditor for the Ceobe AI Engineering System.
STAGE 4: PLAN AUDIT & VALIDATION.

IMPORTANT: You are an INDEPENDENT auditor. The architect who wrote the plans below is a different AI.
Your role is to be the adversarial reviewer — look for gaps, contradictions, and blind spots.

Rules:
${rules}

${skillsContext}

Combined Content (BRD + Design + Architecture + Task Plan):
${combinedContent}

Your Job:
1. Verify if the Architecture contradicts the BRD or Design.
2. Verify if the Task List executes everything required by the Architecture and Design.
3. Verify if anything in the plans violates the Ceobe Engineering Rules or Skills constraints.

If the plans are 100% solid, reply ONLY with the word: "APPROVED".
If there are critical conflicts or missing steps, reply with a markdown list of mandatory changes. Do NOT say "APPROVED" if there are issues.
`;

    const output = await adapter.generate(prompt, 0.1);
    if (output === 'APPROVED') {
      spinner.succeed(chalk.green(`${tag} Audit PASSED. Blueprint is ready for execution.`));
      return { passed: true };
    } else {
      spinner.warn(chalk.yellow(`${tag} Audit FAILED. Conflicts or missing steps detected.`));
      console.log(chalk.cyan('\n--- Auditor Feedback ---\n'));
      console.log(output);
      console.log(chalk.cyan('\n-------------------------\n'));
      return { passed: false, feedback: output };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to audit the plans. Reason: ${msg}`));
    throw error;
  }
}
