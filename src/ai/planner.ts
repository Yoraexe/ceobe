import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { getGatewayUrl } from './gateway';
import chalk from 'chalk';
import ora from 'ora';
import { readCeobeRules, readTemplate, getAvailableSkills, readSpecificSkills } from '../utils/contextLoader';

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
  // Note: Depending on the exact SDK version/options, 
  // baseUrl mapping might require custom fetch or specific instantiation config.
  // Using native fetch or overriding baseUrl here ensures routing via Cloudflare.
});

/**
 * PHASE 0: SKILL CLASSIFICATION
 * Determines which specific skill sets are needed for the user's task.
 */
export async function selectRelevantSkills(taskDescription: string): Promise<string[]> {
  const spinner = ora('Gemini 3.1 Pro is analyzing the required skills for this task...').start();
  try {
    const availableSkills = getAvailableSkills();
    if (availableSkills.length === 0) {
      spinner.succeed('No skills found in workspace. Proceeding without skills.');
      return [];
    }

    const systemInstruction = `
You are the Ceobe AI Skill Router.
Your ONLY job is to analyze the user request and determine which internal skills are required.

Available Skills:
${availableSkills.join(', ')}

User Request:
${taskDescription}

Analyze the request. Output ONLY a raw, comma-separated list of the exact skill names required. If none apply, output "none".
Example: "cost-reducer, scalability, frontend-design"
NO markdown, NO greetings, NO extra text.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [ { role: 'user', parts: [{ text: systemInstruction }] } ],
        config: { temperature: 0.0 } // 0.0 for strict deterministic classification
    });

    const output = (response.text || '').trim();
    if (output.toLowerCase() === 'none') {
      spinner.succeed(chalk.green('Gemini selected NO specific skills.'));
      return [];
    }

    const selected = output.split(',').map(s => s.trim()).filter(s => availableSkills.includes(s));
    spinner.succeed(chalk.green(`Gemini selected skills: ${selected.join(', ')}`));
    return selected;
  } catch (error: any) {
    spinner.fail(chalk.red('Failed to route skills. Proceeding with base rules only.'));
    return [];
  }
}

export async function generateBRD(taskDescription: string, selectedSkills: string[] = []): Promise<string> {
  const spinner = ora('Gemini 3.1 Pro is analyzing the request and generating a Business Requirements Document...').start();
  
  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
    
    const systemInstruction = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 1: DISCOVERY & BRD.

Adhere to these rules:
${rules}

${skillsContext}

User Request:
${taskDescription}

Output ONLY the markdown Business Requirements Document (BRD). Do not output greetings or implementation steps yet. Focus on goals, target audience, and feature definitions.

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('brd-template.md')}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [ { role: 'user', parts: [{ text: systemInstruction }] } ],
        config: { temperature: 0.2 }
    });

    spinner.succeed(chalk.green('Gemini 3.1 Pro successfully generated the BRD.'));
    return response.text || '';
  } catch (error: any) {
    spinner.fail(chalk.red('Gemini 3.1 Pro failed to generate BRD.'));
    throw error;
  }
}

export async function generateArchitecture(brdContent: string, selectedSkills: string[] = []): Promise<string> {
  const spinner = ora('Gemini 3.1 Pro is designing the System Architecture...').start();
  
  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
    
    const systemInstruction = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 2: ARCHITECTURE DESIGN.

Rules:
${rules}

${skillsContext}

Current BRD Context:
${brdContent}

Output ONLY the markdown Architecture Document based on the constraints. Outline the tech stack, data schemas, and folder structures. Do not write full code.

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('architecture-template.md')}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [ { role: 'user', parts: [{ text: systemInstruction }] } ],
        config: { temperature: 0.2 }
    });

    spinner.succeed(chalk.green('Gemini 3.1 Pro successfully generated the Architecture Plan.'));
    return response.text || '';
  } catch (error: any) {
    spinner.fail(chalk.red('Gemini 3.1 Pro failed to generate Architecture Plan.'));
    throw error;
  }
}

export async function generateImplementationPlan(architectureContent: string, selectedSkills: string[] = []): Promise<string> {
  const spinner = ora('Gemini 3.1 Pro is generating the Execution Checklist...').start();
  
  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
    
    const systemInstruction = `
You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE 3: IMPLEMENTATION / SPRINT PLANNING.

Rules:
${rules}

${skillsContext}

Current Architecture Plan Context:
${architectureContent}

Output ONLY the markdown execution checklist (a Jira-like task list). Detail what file paths to create/edit and exactly what code Claude should write in each file.

YOU MUST FORMAT YOUR OUTPUT EXACTLY ACCORDING TO THIS TEMPLATE:
${readTemplate('tasks-template.md')}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [ { role: 'user', parts: [{ text: systemInstruction }] } ],
        config: { temperature: 0.2 }
    });

    spinner.succeed(chalk.green('Gemini 3.1 Pro successfully generated the Execution Checklist.'));
    return response.text || '';
  } catch (error: any) {
    spinner.fail(chalk.red('Gemini 3.1 Pro failed to generate Checklist.'));
    throw error;
  }
}

export async function auditPlan(combinedContent: string, selectedSkills: string[] = []): Promise<boolean> {
  const spinner = ora('Gemini 3.1 Pro is auditing the project plans for conflicts and rule violations...').start();
  
  try {
    const rules = readCeobeRules();
    const skillsContext = selectedSkills.length > 0 ? readSpecificSkills(selectedSkills) : '';
    
    const systemInstruction = `
You are the Lead Quality Assurance Auditor for the Ceobe AI Engineering System.
STAGE 4: PLAN AUDIT & VALIDATION.

Rules:
${rules}

${skillsContext}

Below is the combined content of the BRD, Architecture, and Task execution plan that the user has manually reviewed and potentially edited.

Combined Content:
${combinedContent}

Your Job:
1. Verify if the Architecture contradicts the BRD.
2. Verify if the Task List executes everything required by the Architecture.
3. Verify if anything in the plans violates the core Ceobe Engineering Rules or the provided Skills constraints (e.g. using npm when bun-developer is active).

If the plans are 100% solid and ready for execution, reply ABSOLUTELY ONLY with the word: "APPROVED".
If there are critical conflicts, bugs, or missing steps, reply with a markdown list of the mandatory changes needed. Do NOT say "APPROVED" if there are warnings.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [ { role: 'user', parts: [{ text: systemInstruction }] } ],
        config: { temperature: 0.1 }
    });

    const output = (response.text || '').trim();
    if (output === 'APPROVED') {
      spinner.succeed(chalk.green('Audit PASSED. Project blueprint is solid and ready for execution.'));
      return true;
    } else {
      spinner.warn(chalk.yellow('Audit FAILED. Conflicts or missing steps detected.'));
      console.log(chalk.cyan(`\\n--- Auditor Feedback ---\\n`));
      console.log(output);
      console.log(chalk.cyan(`\\n-------------------------\\n`));
      return false;
    }
  } catch (error: any) {
    spinner.fail(chalk.red('Gemini 3.1 Pro failed to audit the plans.'));
    throw error;
  }
}
