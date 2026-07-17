// Tujuan: Menampilkan status pipeline aktif, file-file yang termodifikasi, dan snapshot git saat ini.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, utils/stateManager, utils/gitManager, utils/modeManager
// Main Functions: registerStatusCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getCostSummary } from '../../../utils/costTracker';
import { getProjectDir } from '../../../utils/context';
import { printBanner, printSection, ok, warn, hint, info } from '../../../ui/banner';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('📊  Tampilkan status pipeline & progress proyek saat ini')
    .action(() => {
      printBanner();
      printSection('📊 Status Pipeline Proyek');
      const ceobeDir = path.join(getProjectDir(), '.ceobe');

      if (!fs.existsSync(ceobeDir)) {
        warn('Workspace belum diinisialisasi. Belum ada plan yang dibuat.');
        hint('Mulai dengan: ceobe plan "Deskripsi proyekmu" atau ceobe auto "Deskripsi"');
        return;
      }

      // Read state
      const statePath = path.join(ceobeDir, 'ceobe-state.json');
      if (fs.existsSync(statePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          const PHASE_ORDER = ['plan', 'design', 'audit', 'execute', 'verify', 'devops', 'done'];
          const PHASE_LABELS: Record<string, string> = {
            plan: '📋 Planning', design: '🎨 Design', audit: '🔍 Audit',
            execute: '⚡ Execute', verify: '✅ Verify', devops: '🚀 DevOps', done: '🎉 Done'
          };

          console.log('');
          for (const phase of PHASE_ORDER) {
            const isCompleted = state.completedPhases?.includes(phase);
            const isCurrent = state.currentPhase === phase;
            const label = PHASE_LABELS[phase] || phase;
            if (isCompleted) {
              console.log(chalk.green(`  ✅  ${label}`));
            } else if (isCurrent) {
              console.log(chalk.yellow(`  ▶   ${label}`) + chalk.bold.yellow('  ← SEKARANG'));
            } else {
              console.log(chalk.dim(`  ○   ${label}`));
            }
          }
          console.log('');
          console.log(chalk.dim(`  Terakhir diperbarui: ${state.lastUpdated || '-'}`) );
          const fileCount = state.completedFiles?.length || 0;
          if (fileCount > 0) {
            console.log(chalk.dim(`  File selesai ditulis: ${chalk.cyan(String(fileCount))} file`));
          }
          const healCount = state.selfHealCount ?? 0;
          if (healCount > 0) {
            console.log(chalk.cyan(`  🩹 Self-Heal cycles: ${healCount} (AI memperbaiki ${healCount} error secara otomatis)`));
          }
          console.log(chalk.cyan(`  ${getCostSummary()}`));
        } catch {
          warn('Gagal membaca state file. Mungkin corrupt.');
        }
      } else {
        info('State file tidak ditemukan. Plan mungkin belum dijalankan.');
      }

      // Show which plan files exist
      console.log('');
      printSection('📁 Dokumen Plan (.ceobe/)');
      const planFiles = ['brd.md', 'design.md', 'architecture.md', 'devops.md', 'task.md'];
      for (const f of planFiles) {
        const fp = path.join(ceobeDir, f);
        if (fs.existsSync(fp)) {
          const size = (fs.statSync(fp).size / 1024).toFixed(1);
          ok(`${f.padEnd(20)} ${chalk.dim(size + ' KB')}`);
        } else {
          console.log(chalk.dim(`  ○   ${f.padEnd(20)} belum ada`));
        }
      }
      console.log('');
    });
}
