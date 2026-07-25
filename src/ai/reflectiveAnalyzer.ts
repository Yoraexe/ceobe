// Tujuan: Menganalisis berkas log eksekusi (.ceobe/execution.log) untuk mengevaluasi efisiensi biaya/token dan merancang draf skill baru secara reflektif.
// Caller: cli commands, telegram handlers
// Dependensi: fs, path, chalk, ora, utils/context, ai/providers/router, utils/costTracker
// Main Functions: analyzeExecutionLog
// Side Effects: Membaca berkas log eksekusi dan menulis draf skill baru ke folder `skills/`.

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

    // Fix M-07: Read at most the last 500KB of log file to prevent loading massive files into memory
    const stats = fs.statSync(logPath);
    const maxReadBytes = 500 * 1024;
    let logContent = '';

    if (stats.size > maxReadBytes) {
      const buffer = Buffer.alloc(maxReadBytes);
      const fd = fs.openSync(logPath, 'r');
      fs.readSync(fd, buffer, 0, maxReadBytes, stats.size - maxReadBytes);
      fs.closeSync(fd);
      logContent = buffer.toString('utf-8');
    } else {
      logContent = fs.readFileSync(logPath, 'utf-8');
    }

    const lines = logContent.split('\n').filter(l => l.trim().length > 0);
    const recentLines = lines.slice(-500).join('\n');

    const spinner = ora('Reflecting on recent execution logs...').start();

    const adapter = createProviderAdapter('planner');
    
    // Fix M-08: Complete XML sanitization for log entries
    const sanitizedLog = recentLines
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const prompt = `You are a Principal Engineering Manager reflecting on the AI agent's recent execution logs.
Analyze the following logs to identify:
1. Inefficiency patterns (e.g. repeated tool failures, stuck loops).
2. Cost anomalies (repeated planning, big file writes).
3. Missing skills or knowledge gaps.

Log data:
<LOG_ENTRIES>
${sanitizedLog}
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

        let report: ReflectionReport;
        try {
            report = JSON.parse(jsonStr) as ReflectionReport;
        } catch (parseErr) {
            spinner.warn(chalk.yellow(`[ReflectiveAnalyzer] Failed to parse LLM reflection output. Raw response snippet: ${jsonStr.slice(0, 100)}...`));
            report = {
                period: { from: new Date().toISOString(), to: new Date().toISOString() },
                efficiencyScore: 100,
                patterns: ['Could not parse reflection output from LLM.'],
                suggestedSkills: [],
                costOutliers: []
            };
        }
        
        // Ensure defaults for arrays and fields to prevent TypeError
        if (!report.patterns || !Array.isArray(report.patterns)) report.patterns = [];
        if (!report.suggestedSkills || !Array.isArray(report.suggestedSkills)) report.suggestedSkills = [];
        if (!report.costOutliers || !Array.isArray(report.costOutliers)) report.costOutliers = [];
        if (typeof report.efficiencyScore !== 'number') report.efficiencyScore = 100;
        
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
            // Fix M-09: Sanitize skillName to strip leading and trailing hyphens
            const skillName = report.suggestedSkills[0].replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '');
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
