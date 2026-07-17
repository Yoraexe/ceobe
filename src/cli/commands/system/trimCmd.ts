// Tujuan: Memangkas berkas log eksekusi yang terlalu besar secara manual.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, fs, path, utils/context
// Main Functions: registerTrimCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getProjectASTSummary } from '../../../ai/memory/indexer';
import { buildCodebaseAuditPrompt } from '../../../ai/utils/promptBuilder';
import { createProviderAdapter } from '../../../ai/providers/router';
import { recordUsage } from '../../../utils/costTracker';

export function registerTrimCommand(program: Command): void {
  program
    .command('trim')
    .description('✂️  Whole-Repo Bloat Scanner: Pindai codebase untuk mencari abstraksi berlebihan (over-engineering).')
    .action(async () => {
      console.log(chalk.cyan('Mengekstrak AST (Abstract Syntax Tree) dari seluruh workspace...\n'));
      
      const spinner = ora('Memampatkan kode sumber...').start();
      
      try {
        const astSummary = await getProjectASTSummary();
        
        if (!astSummary.trim()) {
          spinner.succeed(chalk.green('Workspace kosong atau tidak ada file TypeScript yang didukung.'));
          return;
        }

        spinner.text = 'Menganalisis AST menggunakan QA Auditor Brain...';
        
        const prompt = buildCodebaseAuditPrompt(astSummary);
        
        // We use a fast/cheap model by default for this heavy AST scan to prevent massive costs.
        // In Ceobe, the auditor or planner adapter can be requested.
        const adapter = createProviderAdapter('qa');
        
        const genResult = await adapter.generate(prompt, 0.2);
        
        if (genResult.usage) {
          recordUsage({
            model: adapter.modelId,
            inputTokens: genResult.usage.input_tokens || 0,
            outputTokens: genResult.usage.output_tokens || 0
          });
        }
        
        spinner.succeed(chalk.green('Audit Selesai. Laporan Ponytail Auditor:\n'));
        
        console.log(chalk.yellow(genResult.text));
        
      } catch (err: any) {
        spinner.fail(chalk.red(`Gagal melakukan audit codebase: ${err.message}`));
      }
    });
}
