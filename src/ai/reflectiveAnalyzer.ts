import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getProjectDir } from '../utils/context';
import { createProviderAdapter } from './providers/router';
import { recordUsage } from '../utils/costTracker';

export interface ReflectionReport {
  period: { from: string; to: string };
  patterns: string[];
  costOutliers: string[];
  suggestedSkills: string[];
  efficiencyScore: number;
}

export async function analyzeExecutionLog(autoGenerateSkill = false): Promise<ReflectionReport | null> {
    const logPath = path.join(getProjectDir(), '.ceobe', 'execution.log');
    if (!fs.existsSync(logPath)) {
        console.log(chalk.yellow('No execution.log found. Run some tasks first.'));
        return null;
    }

    const logContent = fs.readFileSync(logPath, 'utf-8');
    const lines = logContent.split('\n').filter(l => l.trim().length > 0);
    const recentLines = lines.slice(-500).join('\n');

    const spinner = ora('Reflecting on recent execution logs...').start();

    const adapter = createProviderAdapter('planner');
    
    const prompt = `You are a Principal Engineering Manager reflecting on the AI agent's recent execution logs.
Analyze the following logs to identify:
1. Inefficiency patterns (e.g. repeated tool failures, stuck loops).
2. Cost anomalies (repeated planning, big file writes).
3. Missing skills or knowledge gaps.

Log data:
<LOG_ENTRIES>
${recentLines.replace(/<LOG_ENTRIES>/gi, '[SANITIZED]').replace(/<\/LOG_ENTRIES>/gi, '[SANITIZED]')}
</LOG_ENTRIES>

Output your analysis as a strict JSON object with this shape:
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "patterns": ["string"],
  "costOutliers": ["string"],
  "suggestedSkills": ["skill name 1", "skill name 2"],
  "efficiencyScore": 85
}
Ensure it is valid JSON with no markdown wrapping like \`\`\`json.`;

    try {
        const response = await adapter.generate(prompt, 0.2);
        if (response.usage) {
            recordUsage({
                model: adapter.modelId,
                inputTokens: response.usage.input_tokens || 0,
                outputTokens: response.usage.output_tokens || 0
            });
        }
        
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
        }
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        const report = JSON.parse(jsonStr) as ReflectionReport;
        
        spinner.succeed(chalk.green('Reflection analysis complete.'));
        
        console.log(chalk.cyan(`\n--- Reflection Report (Score: ${report.efficiencyScore}/100) ---`));
        if (report.patterns.length > 0) {
            console.log(chalk.yellow('\nInefficiency Patterns:'));
            report.patterns.forEach(p => console.log(` - ${p}`));
        }
        if (report.suggestedSkills.length > 0) {
            console.log(chalk.magenta('\nSuggested New Skills:'));
            report.suggestedSkills.forEach(s => console.log(` - ${s}`));
        }
        
        if (autoGenerateSkill && report.suggestedSkills.length > 0) {
            console.log(chalk.blue(`\n[Auto-Skill] Drafting new skill: ${report.suggestedSkills[0]}...`));
            const skillName = report.suggestedSkills[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const skillDir = path.join(getProjectDir(), 'skills', skillName);
            fs.mkdirSync(skillDir, { recursive: true });
            
            const skillContent = `---
name: ${skillName}
description: Auto-generated skill from reflection analysis addressing: ${report.suggestedSkills[0]}
---
# ${skillName.toUpperCase()} SKILL

## Auto-Generated Draft
This skill was identified as missing during execution reflection.
Update this file with appropriate guidelines and anti-patterns.
`;
            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent);
            console.log(chalk.green(`✅ Skill draft created at ${path.relative(getProjectDir(), path.join(skillDir, 'SKILL.md'))}`));
        }

        return report;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        spinner.fail(chalk.red(`Reflection failed: ${msg}`));
        return null;
    }
}
