import { Command } from 'commander';
import { analyzeExecutionLog } from '../../../ai/reflectiveAnalyzer';

export function registerReflectCommand(program: Command): void {
  program
    .command('reflect')
    .description('Analyze execution logs to find inefficiency patterns and suggest skills')
    .option('--auto-skill', 'Auto-generate a new skill draft based on reflections')
    .action(async (options) => {
      await analyzeExecutionLog(options.autoSkill);
    });
}
