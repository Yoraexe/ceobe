import { Command } from 'commander';
import { runAutonomousLoop } from '../../ai/supervisor';
import { printBanner, printError } from '../../ui/banner';
import { resolveFileInput } from '../utils/fileResolver';
import { activateSandbox } from '../utils/sandbox';

export function registerAutoCommand(program: Command): void {
  program
    .command('auto [description]')
    .description('🤖  Jalankan pipeline penuh secara otonom: plan → audit → execute')
    .option('--ask', 'Minta konfirmasi sebelum eksekusi (human-in-the-loop)')
    .option('--feature', 'Mode tambah fitur baru ke proyek yang sudah ada')
    .option('--file <path>', 'Gunakan file PRD atau mockup UI sebagai sumber requirement')
    .option('--sandbox', 'Isolasi eksekusi AI dalam Docker container (requires Docker)')
    .addHelpText('after', `
  Contoh:
    ceobe auto "Build a REST API with Go and PostgreSQL"
    ceobe auto --file requirements.md
    ceobe auto --file mockup.png "tambahkan dark mode"
    ceobe auto --feature "tambahkan fitur payment gateway"
    ceobe auto --ask "Build a Flutter app"   ← pause sebelum eksekusi
    ceobe auto --sandbox "Build API"          ← eksekusi terisolasi dalam Docker
`)
    .action(async (description: string | undefined, options: { ask: boolean; feature: boolean; file?: string; sandbox: boolean }) => {
      printBanner();
      if (options.sandbox) activateSandbox();

      let finalDescription: string | object[] = description || '';
      if (options.file) {
        finalDescription = resolveFileInput(options.file, description);
      }
      if (!finalDescription || (Array.isArray(finalDescription) && finalDescription.length === 0)) {
        printError(
          'Deskripsi proyek diperlukan',
          'Kamu belum memberikan deskripsi atau file requirement.',
          'ceobe auto "Deskripsi proyekmu" atau ceobe auto --file requirement.md'
        );
        process.exit(1);
      }

      await runAutonomousLoop(finalDescription as any, !!options.ask, !!options.feature);
    });
}
