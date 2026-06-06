import { Command } from 'commander';
import chalk from 'chalk';
import { setMode, printModeBadge, type CeobeMode } from '../../../utils/modeManager';
import { printBanner, printSection, ok, info, printError } from '../../../ui/banner';

export function registerModeCommand(program: Command): void {
  program
    .command('mode [newMode]')
    .description('🔄  Lihat atau ubah mode eksekusi Ceobe')
    .addHelpText('after', `
  Mode yang tersedia:
    autonomous   Ceobe bekerja penuh otomatis tanpa jeda
    ask          Ceobe minta persetujuan sebelum setiap aksi destruktif

  Contoh:
    ceobe mode              ← tampilkan mode aktif
    ceobe mode autonomous
    ceobe mode ask
`)
    .action((newMode?: string) => {
      if (!newMode) {
        printBanner();
        printSection('🔄 Mode Aktif');
        printModeBadge();
        console.log('');
        info('Ubah mode dengan: ' + chalk.cyan('ceobe mode autonomous') + ' atau ' + chalk.cyan('ceobe mode ask'));
        return;
      }

      const validModes: CeobeMode[] = ['autonomous', 'ask'];
      if (!validModes.includes(newMode as CeobeMode)) {
        printError(`Mode tidak valid: '${newMode}'`, 'Pilih salah satu dari: autonomous | ask', 'ceobe mode autonomous');
        process.exit(1);
      }
      setMode(newMode as CeobeMode);
      console.log('');
      ok(`Mode diubah ke: ${chalk.bold.cyan(newMode)}`);
      printModeBadge();
      console.log('');
    });
}
