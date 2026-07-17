// Tujuan: Mengelola template rencana tugas untuk mempercepat perencanaan.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, ai/templateManager
// Main Functions: registerTemplateCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import { getTemplates, clearTemplates, deleteTemplate } from '../../../ai/templateManager';
import chalk from 'chalk';

export function registerTemplateCommand(program: Command): void {
  const templateCmd = program
    .command('templates')
    .description('Manajemen task templates yang tersimpan');

  templateCmd
    .command('list')
    .description('Lihat daftar task templates')
    .action(() => {
      const templates = getTemplates();
      if (templates.length === 0) {
        console.log(chalk.yellow('Belum ada template yang tersimpan. Jalankan task dengan sukses terlebih dahulu.'));
        return;
      }
      
      console.log(chalk.green(`\n📋 Tersedia ${templates.length} Template:`));
      templates.forEach((t, i) => {
        console.log(chalk.cyan(`\n${i + 1}. [${t.id}]`));
        console.log(chalk.dim(`   Deskripsi: ${t.description.substring(0, 80)}${t.description.length > 80 ? '...' : ''}`));
      });
      console.log();
    });

  templateCmd
    .command('clear')
    .description('Hapus semua task templates')
    .action(() => {
      clearTemplates();
      console.log(chalk.green('✅ Semua template berhasil dihapus.'));
    });

  templateCmd
    .command('delete <id>')
    .description('Hapus template spesifik berdasarkan ID')
    .action((id: string) => {
      const success = deleteTemplate(id);
      if (success) {
        console.log(chalk.green(`✅ Template ${id} berhasil dihapus.`));
      } else {
        console.log(chalk.red(`❌ Template ${id} tidak ditemukan.`));
      }
    });
}
