import ora from 'ora';
import chalk from 'chalk';
import { createProviderAdapter } from '../providers/router';
import { buildSkillRouterPrompt } from '../utils/promptBuilder';
import { getAvailableSkills } from '../../utils/contextLoader';
import { recordUsage } from '../../utils/costTracker';
import type { NormalizedContentBlock } from '../providers/types';

function getPlanner() {
  const adapter = createProviderAdapter('planner');
  const tag = `[${adapter.name.toUpperCase()} / ${adapter.modelId}]`;
  return { adapter, tag };
}

export async function selectRelevantSkills(taskDescription: string | NormalizedContentBlock[]): Promise<string[]> {
  const { adapter, tag } = getPlanner();
  const spinner = ora(`${tag} Analyzing required skills...`).start();

  try {
    const availableSkills = getAvailableSkills();
    if (availableSkills.length === 0) {
      spinner.succeed('No skills found. Proceeding without skills.');
      return [];
    }

    const promptText = typeof taskDescription === 'string' 
      ? buildSkillRouterPrompt(taskDescription)
      : `You are the Ceobe AI Skill Router. Analyze the text and image to determine required skills.\nAvailable Skills: ${availableSkills.join(', ')}\nOutput ONLY a raw, comma-separated list.`;

    const prompt: string | any[] = typeof taskDescription === 'string'
      ? promptText
      : [
          { type: 'text', text: promptText },
          ...taskDescription
        ];

    const _genResult = await adapter.generate(prompt, 0.0);
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); }
    const output = _genResult.text;
    
    if (output.toLowerCase() === 'none') {
      spinner.succeed(chalk.green(`${tag} No specific skills selected.`));
      return [];
    }

    const selected = output.split(',').map(s => s.trim().toLowerCase());
    // Fix M-38: Use strict equality to prevent unintended skills from being loaded due to loose substring matching
    const matchedSkills = availableSkills.filter(as => selected.some(s => as.toLowerCase() === s));
    spinner.succeed(chalk.green(`${tag} Skills selected: ${matchedSkills.join(', ')}`));
    return matchedSkills;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to route skills. Proceeding with base rules only. Reason: ${msg}`));
    return [];
  }
}
