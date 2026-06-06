import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getProjectDir } from '../../../utils/context';
import { warn, hint, ok } from '../../../ui/banner';

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('💣  Hapus semua plan & state Ceobe di workspace ini')
    .option('--yes', 'Konfirmasi otomatis tanpa prompt')
    .action((options: { yes: boolean }) => {
      const ceobeDir = path.join(getProjectDir(), '.ceobe');
      if (!fs.existsSync(ceobeDir)) {
        warn('Folder .ceobe/ tidak ditemukan. Workspace sudah bersih.');
        return;
      }

      if (!options.yes) {
        console.log('');
        console.log(chalk.red.bold('  ╔═══ ⚠️  PERINGATAN ══════════════════════════════════════╗'));
        console.log(chalk.red('  ║  Ini akan menghapus SEMUA plan, arsitektur, state        ║'));
        console.log(chalk.red('  ║  dan log di folder .ceobe/                               ║'));
        console.log(chalk.yellow('  ║  Source code proyekmu TETAP AMAN.                        ║'));
        console.log(chalk.red.bold('  ╚════════════════════════════════════════════════════════╝'));
        console.log('');
        hint('Untuk melanjutkan: ' + chalk.cyan('ceobe reset --yes'));
        console.log('');
        return;
      }

      fs.rmSync(ceobeDir, { recursive: true, force: true });
      console.log('');
      ok('Workspace berhasil di-reset. Semua plan dan log telah dihapus.');
      hint('Mulai ulang dengan: ceobe plan "Deskripsi proyekmu"');
      console.log('');
    });
}
