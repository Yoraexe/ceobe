import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir } from '../../../utils/context';
import { rollbackToSnapshot } from '../../../utils/gitManager';
import { askUserConfirmation } from '../../../ai/utils/loopHandlers';
import { printBanner, warn, info } from '../../../ui/banner';

export function registerRollbackCommand(program: Command): void {
  program
    .command('rollback')
    .description('⏪  Kembalikan (revert) kode ke kondisi sebelum eksekusi AI terakhir')
    .action(async () => {
      printBanner();
      console.log(chalk.cyan('=== CEOBE ROLLBACK ===\n'));

      const statePath = path.join(getProjectDir(), '.ceobe', 'ceobe-state.json');
      if (!fs.existsSync(statePath)) {
        warn('State file tidak ditemukan. Ceobe belum pernah berjalan di direktori ini.');
        return;
      }

      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        const hash = state.lastSnapshotHash;
        
        if (!hash) {
          warn('Tidak ada catatan snapshot Git yang ditemukan pada sesi terakhir.');
          info('Jika Anda menggunakan Git, Anda bisa mengecek history menggunakan perintah `git log`.');
          return;
        }

        warn(`⚠️ PERHATIAN: Ini akan melakukan HARD RESET Git ke commit [${hash.substring(0, 8)}].`);
        warn(`Semua pekerjaan yang belum di-commit dan hasil pekerjaan AI terakhir akan HILANG secara permanen!`);
        
        const proceed = await askUserConfirmation('Apakah Anda yakin ingin melakukan rollback?');
        if (!proceed) {
          info('Rollback dibatalkan.');
          return;
        }

        await rollbackToSnapshot(hash);
        
      } catch (err: unknown) {
        warn(`Gagal memproses rollback: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}
