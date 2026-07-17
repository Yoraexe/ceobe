// Tujuan: Menjalankan scanner pendeteksi hutang teknis kode di dalam direktori kerja.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, ai/memory/debtScanner
// Main Functions: registerDebtCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import chalk from 'chalk';
import { scanTechnicalDebt } from '../../../ai/memory/debtScanner';

export function registerDebtCommand(program: Command): void {
  program
    .command('debt')
    .description('Ledger: Kumpulkan dan analisis hutang teknis dari komentar (// ceobe: atau // ponytail:) di seluruh codebase.')
    .action(() => {
      console.log(chalk.cyan('Scanning Tech Debt Ledger...\n'));
      
      const entries = scanTechnicalDebt();
      
      if (entries.length === 0) {
        console.log(chalk.green('✅ No technical debt found. Clean ledger.'));
        return;
      }
      
      // Group by file
      const grouped: Record<string, typeof entries> = {};
      let noTriggerCount = 0;

      for (const entry of entries) {
        if (!grouped[entry.filePath]) {
          grouped[entry.filePath] = [];
        }
        grouped[entry.filePath].push(entry);
        if (!entry.hasTrigger) {
          noTriggerCount++;
        }
      }
      
      for (const [file, fileEntries] of Object.entries(grouped)) {
        console.log(chalk.blue.bold(`\n📄 ${file}`));
        for (const entry of fileEntries) {
          console.log(chalk.yellow(`  Line ${entry.line}: `) + chalk.white(entry.ceiling));
          if (entry.hasTrigger) {
            console.log(chalk.gray(`    ↳ Upgrade path: ${entry.upgrade}`));
          } else {
            console.log(chalk.red(`    ↳ [ROT RISK] No upgrade trigger specified!`));
          }
        }
      }
      
      console.log(chalk.cyan(`\nTotal: ${entries.length} markers, `) + chalk.red(`${noTriggerCount} without trigger.`));
    });
}
