// Tujuan: Memicu refleksi log eksekusi secara lokal untuk mengevaluasi efisiensi langkah kerja.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, ai/reflectiveAnalyzer
// Main Functions: registerReflectCommand
// Side Effects: Tidak ada.

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
