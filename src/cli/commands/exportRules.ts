// Tujuan: Mendaftarkan perintah CLI 'ceobe export-rules' untuk mengekspor aturan rekayasa Ceobe ke konfigurasi lokal IDE (Cursor, Windsurf, RooCode, Zed).
// Caller: src/index.ts
// Dependensi: commander, fs, path, chalk, utils/context
// Main Functions: registerExportRulesCommand
// Side Effects: Menulis berkas aturan konfigurasi asisten ke dalam folder tersembunyi proyek (.cursor, .windsurf, .clinerules, dll.).

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getProjectDir } from '../../utils/context';

export function registerExportRulesCommand(program: Command): void {
  program
    .command('export-rules')
    .description('📤  Ekspor aturan Ceobe (engineering-rules.md) agar AI IDE Anda (Cursor, Windsurf, dll) patuh pada arsitektur Ceobe.')
    .action(async () => {
      console.log(chalk.cyan('Mengekspor Ceobe Rules ke konfigurasi lokal IDE...'));

      const projectDir = getProjectDir();
      
      // Load source engineering-rules.md from global ceobe installation
      // assuming rules are distributed with the CLI in the 'rules' directory relative to src
      const globalRulesPath = path.join(__dirname, '..', '..', '..', 'rules', 'engineering-rules.md');
      
      let rulesContent = '';
      try {
        rulesContent = fs.readFileSync(globalRulesPath, 'utf8');
      } catch (err) {
        console.error(chalk.red(`Gagal membaca file engineering-rules.md global dari ${globalRulesPath}`));
        console.error(chalk.yellow(`Pastikan Anda menjalankan CLI dari instalasi yang valid.`));
        process.exit(1);
      }

      // 1. Cursor (.cursor/rules/ceobe.mdc)
      const cursorDir = path.join(projectDir, '.cursor', 'rules');
      const cursorFile = path.join(cursorDir, 'ceobe.mdc');
      const cursorFrontmatter = `---\ndescription: Ceobe Engineering Rules. Always follow these structural patterns to prevent architectural drift.\nglobs: *\nalwaysApply: true\n---\n\n`;

      // 2. Windsurf (.windsurf/rules/ceobe.md)
      const windsurfDir = path.join(projectDir, '.windsurf', 'rules');
      const windsurfFile = path.join(windsurfDir, 'ceobe.md');

      // 3. RooCode/Cline (.clinerules)
      const clineFile = path.join(projectDir, '.clinerules');

      // 4. Google Antigravity & Zed (.agents/rules/AGENTS.md)
      const agentsDir = path.join(projectDir, '.agents', 'rules');
      const agentsFile = path.join(agentsDir, 'AGENTS.md');

      const exportsList = [
        { dir: cursorDir, file: cursorFile, content: cursorFrontmatter + rulesContent, name: 'Cursor' },
        { dir: windsurfDir, file: windsurfFile, content: rulesContent, name: 'Windsurf' },
        { dir: null, file: clineFile, content: rulesContent, name: 'Cline/RooCode' },
        { dir: agentsDir, file: agentsFile, content: rulesContent, name: 'Antigravity & Zed' }
      ];

      for (const target of exportsList) {
        try {
          if (target.dir && !fs.existsSync(target.dir)) {
            fs.mkdirSync(target.dir, { recursive: true });
          }
          fs.writeFileSync(target.file, target.content, 'utf8');
          console.log(chalk.green(`✅ Berhasil membuat aturan untuk ${target.name} di ${path.relative(projectDir, target.file)}`));
        } catch (err: any) {
          console.error(chalk.red(`❌ Gagal membuat aturan untuk ${target.name}: ${err.message}`));
        }
      }

      console.log(chalk.cyan('\nCross-IDE Rule Exporting selesai! Asisten AI di dalam Editor Anda sekarang diwajibkan mengikuti aturan Ceobe CLI.'));
    });
}
