import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getProjectDir } from '../../../utils/context';
import { printError } from '../../../ui/banner';

export function registerLogCommand(program: Command): void {
  program
    .command('log')
    .description('📝  Tampilkan log eksekusi terbaru')
    .option('-n <lines>', 'Jumlah baris terakhir yang ditampilkan', '80')
    .action((options: { n: string }) => {
      const logPath = path.join(getProjectDir(), '.ceobe', 'execution.log');
      if (!fs.existsSync(logPath)) {
        printError(
          'Log tidak ditemukan',
          'Belum ada eksekusi yang dijalankan di workspace ini.',
          'ceobe execute'
        );
        return;
      }
      const n = parseInt(options.n || '80', 10);
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n').slice(-n);
      const logSize = (fs.statSync(logPath).size / 1024).toFixed(1);

      console.log('');
      console.log(chalk.bold.cyan(`  ═══ Execution Log · ${logSize} KB · (${lines.length} baris terakhir) ════`));
      console.log('');
      lines.forEach(line => {
        if (line.includes('[Error]') || line.includes('ERROR')) {
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('✅') || line.includes('SUCCESS')) {
          console.log(chalk.green(`  ${line}`));
        } else if (line.includes('[Tool]') || line.includes('TOOL')) {
          console.log(chalk.cyan(`  ${line}`));
        } else {
          console.log(chalk.dim(`  ${line}`));
        }
      });
      console.log('');
      console.log(chalk.dim(`  ═══════════════════════════════════════════════════`));
      console.log('');
    });
}
