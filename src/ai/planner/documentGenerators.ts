// Tujuan: Membuat dokumen blueprint spesifikasi teknis dan rencana tugas (BRD, Design Spec, Architecture Spec, DevOps Config, Task List) menggunakan adapter AI.
// Caller: src/ai/supervisor.ts
// Dependensi: providers/router, utils/promptBuilder, utils/costTracker, utils/stateManager
// Main Functions: generateBRD, generateDesignSpec, generateArchitecture, generateImplementationPlan, generateDevOpsConfig
// Side Effects: Tidak ada.

import ora from 'ora';
import chalk from 'chalk';
import { createProviderAdapter } from '../providers/router';
import { 
  buildBRDPrompt, 
  buildDesignPrompt, 
  buildArchitecturePrompt, 
  buildImplementationPrompt, 
  buildDevOpsPrompt
} from '../utils/promptBuilder';
import { recordUsage } from '../../utils/costTracker';
import type { NormalizedContentBlock } from '../providers/types';
import { readState } from '../../utils/stateManager';

function getPlanner() {
  const adapter = createProviderAdapter('planner');
  const tag = `[${adapter.name.toUpperCase()} / ${adapter.modelId}]`;
  return { adapter, tag };
}

export async function generateBRD(
  taskDescription: string | NormalizedContentBlock[],
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating Business Requirements Document...`).start();

  try {
    const state = await readState();
    const isCreative = state?.isCreativeMode;
    const stringDesc = typeof taskDescription === 'string' ? taskDescription : '(See attached image/blocks for input)';
    const basePrompt = buildBRDPrompt(stringDesc, selectedSkills, auditorFeedback, isCreative);

    const prompt: string | any[] = typeof taskDescription === 'string'
      ? basePrompt
      : [
          { type: 'text', text: basePrompt },
          ...taskDescription
        ];

    const _genResult = await adapter.generate(prompt, 0.2); 
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); } 
    const result = _genResult.text;
    spinner.succeed(chalk.green(`${tag} BRD generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate BRD. Reason: ${msg}`));
    throw error;
  }
}

export async function generateDesignSpec(
  brdContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Designing UI/UX & Design System...`).start();

  try {
    const state = await readState();
    const isCreative = state?.isCreativeMode;
    const prompt = buildDesignPrompt(brdContent, selectedSkills, auditorFeedback, isCreative);
    const _genResult = await adapter.generate(prompt, 0.3); 
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); } 
    const result = _genResult.text;
    spinner.succeed(chalk.green(`${tag} Design Spec generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Design Spec. Reason: ${msg}`));
    throw error;
  }
}

export async function generateArchitecture(
  brdContent: string,
  designContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Designing System Architecture...`).start();

  try {
    const state = await readState();
    const isCreative = state?.isCreativeMode;
    const prompt = buildArchitecturePrompt(brdContent, designContent, selectedSkills, auditorFeedback, isCreative);
    const _genResult = await adapter.generate(prompt, 0.2); 
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); } 
    const result = _genResult.text;
    spinner.succeed(chalk.green(`${tag} Architecture Plan generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Architecture Plan. Reason: ${msg}`));
    throw error;
  }
}

export async function generateImplementationPlan(
  architectureContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating Execution Checklist...`).start();

  try {
    const state = await readState();
    const isCreative = state?.isCreativeMode;
    const prompt = buildImplementationPrompt(architectureContent, selectedSkills, auditorFeedback, isCreative);
    const _genResult = await adapter.generate(prompt, 0.2); 
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); } 
    const result = _genResult.text;
    spinner.succeed(chalk.green(`${tag} Execution Checklist generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate Checklist. Reason: ${msg}`));
    throw error;
  }
}

export async function generateDevOpsConfig(
  architectureContent: string,
  _taskContent: string,
  selectedSkills: string[] = [],
  auditorFeedback?: string
): Promise<string> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Generating DevOps & Deployment Config...`).start();

  try {
    const prompt = buildDevOpsPrompt(architectureContent, selectedSkills, auditorFeedback);
    const _genResult = await adapter.generate(prompt, 0.2); 
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); } 
    const result = _genResult.text;
    spinner.succeed(chalk.green(`${tag} DevOps Spec generated successfully.`));
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to generate DevOps Spec. Reason: ${msg}`));
    throw error;
  }
}
