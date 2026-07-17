// Tujuan: Mendaftarkan perintah CLI 'ceobe execute' untuk mengeksekusi rencana tugas (task.md) hasil audit.
// Caller: src/index.ts
// Dependensi: commander, fs, path, chalk, ai/executor, ai/planner, ui/banner, utils/context, utils/stateManager, utils/modeManager, cli/utils/sandbox
// Main Functions: registerExecuteCommand
// Side Effects: Mengeksekusi penulisan kode proyek dan pemanggilan tool eksternal.

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { executeWaves } from '../../ai/executor';
import { selectRelevantSkills } from '../../ai/planner';
import { printBanner, printSection, ok, info, hint, printError } from '../../ui/banner';
import { getProjectDir } from '../../utils/context';
import { markPhaseComplete } from '../../utils/stateManager';
import { printModeBadge } from '../../utils/modeManager';
import { activateSandbox } from '../utils/sandbox';

export function registerExecuteCommand(program: Command): void {
  program
    .command('execute [taskFile]')
    .description('⚡  Eksekusi task plan yang sudah diaudit')
    .option('--sandbox', 'Isolasi eksekusi AI dalam Docker container (requires Docker)')
    .addHelpText('after', `
  Contoh:
    ceobe execute                  ← eksekusi task.md (default)
    ceobe execute feature-task.md  ← eksekusi plan fitur
    ceobe execute --sandbox        ← eksekusi terisolasi dalam Docker
`)
    .action(async (taskFile: string = 'task.md', options: { sandbox: boolean }) => {
      printBanner();
      printModeBadge();
      printSection('⚡ Memulai Eksekusi Plan...');
      if (options.sandbox) activateSandbox();

      try {
        const taskPath = path.join(getProjectDir(), '.ceobe', taskFile);
        if (!fs.existsSync(taskPath)) {
          printError(
            `File task tidak ditemukan: .ceobe/${taskFile}`,
            `Pastikan kamu sudah menjalankan 'ceobe plan' dan 'ceobe audit' terlebih dahulu.`,
            'ceobe plan "Deskripsi proyekmu"'
          );
          return;
        }

        info(`Membaca task dari: ${chalk.cyan(`.ceobe/${taskFile}`)}`);
        let planContent = fs.readFileSync(taskPath, 'utf8');
        const devopsPath = taskPath.replace('task.md', 'devops.md');
        if (fs.existsSync(devopsPath)) {
          planContent += `\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\n${fs.readFileSync(devopsPath, 'utf8')}`;
          info('DevOps config ditemukan dan disertakan.');
        }

        const selectedSkills = await selectRelevantSkills(planContent);
        await executeWaves(planContent, selectedSkills);
        await markPhaseComplete('execute', 'done');

        printSection('🎉 Eksekusi Selesai!');
        ok('Proyek berhasil dibangun oleh Ceobe.');
        hint('Jalankan `ceobe log` untuk melihat detail log eksekusi.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        printError('Eksekusi gagal', msg);
      }
    });
}
