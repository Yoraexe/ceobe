// Tujuan: Menjalankan pemeriksaan kesehatan sistem untuk memverifikasi API keys dan instalasi perkakas pendukung.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, utils/doctor
// Main Functions: registerDoctorCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import { runDoctor } from '../../../utils/doctor';
import { printBanner } from '../../../ui/banner';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('🩺  Diagnosa API key, provider, dan status workspace')
    .action(async () => {
      printBanner();
      await runDoctor();
    });
}
