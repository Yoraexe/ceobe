// Tujuan: Memicu pengindeksan kode penuh untuk menyimpan embeddings pencarian semantik.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, ai/memory/indexer
// Main Functions: registerIndexCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import chalk from 'chalk';
import { indexWorkspace } from '../../../ai/memory/indexer';
import { getProjectDir } from '../../../utils/context';
import { printBanner, printSection, ok, info, printError } from '../../../ui/banner';

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('🧠  Index workspace untuk semantic memory (RAG)')
    .action(async () => {
      printBanner();
      printSection('🧠 Mengindeks Workspace...');
      info(`Target: ${chalk.cyan(getProjectDir())}`);
      try {
        await indexWorkspace();
        ok('Workspace berhasil diindeks. Ceobe kini memiliki memori semantik proyek ini.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        printError('Indexing gagal', msg);
      }
    });
}
