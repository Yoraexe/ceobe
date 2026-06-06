import { Command } from 'commander';
import chalk from 'chalk';
import { getCostSummary } from '../../../utils/costTracker';
import { printBanner, printSection } from '../../../ui/banner';


export function registerCostCommand(program: Command): void {
  program
    .command('cost')
    .description('💰  Tampilkan rincian penggunaan token & estimasi biaya API')
    .action(() => {
      printBanner();
      printSection('💰 Laporan Penggunaan Token API');
      
      // To get global usage if outside context
      // Note: currently getSessionUsageArray is private to costTracker, 
      // but we can rely on the summary string.
      
      console.log(chalk.cyan(`  ${getCostSummary()}`));
      console.log('');
      
      console.log(chalk.dim('  * Estimasi ini berdasarkan daftar harga API per Mei 2026.'));
      console.log(chalk.dim('  * Cache Read (Diskon Prompt Caching) pada beberapa provider mungkin membuat tagihan asli lebih murah dari estimasi.'));
      console.log('');
    });
}
