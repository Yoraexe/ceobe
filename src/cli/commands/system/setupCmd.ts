// Tujuan: Menjalankan proses inisialisasi awal repositori Ceobe dan penyalinan berkas pendukung.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, fs, path, utils/context, config/env
// Main Functions: registerSetupCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import { runSetupWizard } from '../../utils/keyWizard';
import { printBanner } from '../../../ui/banner';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('🔃  Wizard interaktif untuk konfigurasi pertama kali')
    .action(async () => {
      printBanner();
      await runSetupWizard();
    });
}
