// Tujuan: Mendaftarkan perintah CLI 'ceobe plan' untuk menghasilkan blueprint arsitektur dan spesifikasi desain proyek.
// Caller: src/index.ts
// Dependensi: commander, fs, path, chalk, supervisor, documentGenerators, context
// Main Functions: registerPlanCommands
// Side Effects: Tidak ada.

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { 
  selectRelevantSkills, generateBRD, generateDesignSpec, 
  generateArchitecture, generateDevOpsConfig, generateImplementationPlan, auditPlan 
} from '../../ai/planner';
import { printBanner, printSection, printStep, ok, info, printNextStep, printError } from '../../ui/banner';
import { getProjectDir } from '../../utils/context';
import { markPhaseComplete } from '../../utils/stateManager';
import { printModeBadge } from '../../utils/modeManager';
import { resolveFileInput } from '../utils/fileResolver';

export function registerPlanCommands(program: Command): void {
  program
    .command('plan [description]')
    .description('📋  Buat BRD, Desain, Arsitektur & Task Plan (untuk review manual)')
    .option('--feature', 'Rencanakan fitur baru alih-alih proyek baru')
    .option('--file <path>', 'Gunakan file PRD atau mockup UI sebagai sumber requirement')
    .addHelpText('after', `
  Contoh:
    ceobe plan "Landing page dengan autentikasi"
    ceobe plan --file prd.md
    ceobe plan --feature "tambahkan export PDF"
`)
    .action(async (description: string | undefined, options: { feature: boolean; file?: string }) => {
      printBanner();
      printModeBadge();

      const prefix = options.feature ? 'feature-' : '';
      let finalDescription: string | object[] = description || '';
      if (options.file) {
        finalDescription = resolveFileInput(options.file, description);
      }

      if (!finalDescription || (Array.isArray(finalDescription) && finalDescription.length === 0)) {
        printError(
          'Deskripsi proyek diperlukan',
          undefined,
          'ceobe plan "Deskripsi proyekmu" atau ceobe plan --file prd.md'
        );
        process.exit(1);
      }

      const TOTAL_STEPS = 5;
      printSection(options.feature ? '✨ Merencanakan Fitur Baru' : '🚀 Merencanakan Proyek Baru');
      info(`Workspace: ${chalk.white(process.cwd())}`);

      try {
        const ceobeDir = path.join(getProjectDir(), '.ceobe');
        if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

        printStep(1, TOTAL_STEPS, 'Memilih skill yang relevan...');
        const selectedSkills = await selectRelevantSkills(finalDescription as any);
        ok(`Skill dipilih: ${chalk.cyan(selectedSkills.join(', ') || 'general')}`);

        printStep(2, TOTAL_STEPS, 'Membuat Business Requirements Document...');
        const brd = await generateBRD(finalDescription as any, selectedSkills);
        fs.writeFileSync(path.join(ceobeDir, `${prefix}brd.md`), brd);
        ok(`BRD tersimpan → ${chalk.cyan(`.ceobe/${prefix}brd.md`)}`);

        printStep(3, TOTAL_STEPS, 'Membuat Design Specification...');
        const design = await generateDesignSpec(brd, selectedSkills);
        fs.writeFileSync(path.join(ceobeDir, `${prefix}design.md`), design);
        ok(`Design tersimpan → ${chalk.cyan(`.ceobe/${prefix}design.md`)}`);

        printStep(4, TOTAL_STEPS, 'Membuat Architecture & DevOps Config...');
        const arch = await generateArchitecture(brd, design, selectedSkills);
        fs.writeFileSync(path.join(ceobeDir, `${prefix}architecture.md`), arch);
        const devops = await generateDevOpsConfig(arch, brd, selectedSkills);
        fs.writeFileSync(path.join(ceobeDir, `${prefix}devops.md`), devops);
        ok(`Architecture & DevOps tersimpan → ${chalk.cyan(`.ceobe/${prefix}architecture.md`)}`);

        printStep(5, TOTAL_STEPS, 'Membuat Implementation Task Plan...');
        const plan = await generateImplementationPlan(arch, selectedSkills);
        fs.writeFileSync(path.join(ceobeDir, `${prefix}task.md`), plan);
        ok(`Task Plan tersimpan → ${chalk.cyan(`.ceobe/${prefix}task.md`)}`);

        await markPhaseComplete(options.feature ? 'build-feature' : 'plan', 'audit');

        printSection('✅ Planning Selesai!');
        console.log(chalk.dim(`  Semua dokumen tersimpan di folder ${chalk.white('.ceobe/')}`));
        console.log(chalk.dim(`  Review dan edit file-file berikut sesuai kebutuhan:`));
        console.log(chalk.dim(`  ${['brd.md', 'design.md', 'architecture.md', 'devops.md', 'task.md'].map(f => chalk.cyan(prefix + f)).join('  ·  ')}`));
        printNextStep('Setelah review, jalankan audit untuk verifikasi plan:', `ceobe audit ${prefix ? prefix : ''}`.trim());

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        printError('Planning gagal', msg);
        process.exit(1);
      }
    });

  program
    .command('audit [prefix]')
    .description('🔍  Audit plan untuk memastikan konsistensi sebelum eksekusi')
    .addHelpText('after', `
  Contoh:
    ceobe audit              ← audit project baru
    ceobe audit feature-     ← audit plan fitur
`)
    .action(async (prefix: string = '') => {
      printBanner();
      printModeBadge();
      printSection('🔍 Mengaudit Plan...');

      try {
        const ceobeDir = path.join(getProjectDir(), '.ceobe');
        const get = (name: string) => path.join(ceobeDir, prefix ? `${prefix}${name}` : name);

        const brdPath = get('brd.md'), archPath = get('architecture.md');
        const taskPath = get('task.md'), designPath = get('design.md'), devopsPath = get('devops.md');

        if (!fs.existsSync(brdPath) || !fs.existsSync(archPath) || !fs.existsSync(taskPath)) {
          printError(
            'File plan tidak ditemukan di .ceobe/',
            `Pastikan kamu sudah menjalankan 'ceobe plan' terlebih dahulu.`,
            'ceobe plan "Deskripsi proyekmu"'
          );
          return;
        }

        info(`Membaca dokumen dari: ${chalk.cyan('.ceobe/')}`);

        const combinedContent = [
          `--- BRD ---\n${fs.readFileSync(brdPath, 'utf8')}`,
          `--- DESIGN ---\n${fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf8') : ''}`,
          `--- ARCHITECTURE ---\n${fs.readFileSync(archPath, 'utf8')}`,
          `--- DEVOPS ---\n${fs.existsSync(devopsPath) ? fs.readFileSync(devopsPath, 'utf8') : ''}`,
          `--- TASK PLAN ---\n${fs.readFileSync(taskPath, 'utf8')}`,
        ].join('\n\n');

        const briefDescription = fs.readFileSync(brdPath, 'utf8').substring(0, 500);
        const selectedSkills = await selectRelevantSkills(briefDescription);
        const result = await auditPlan(combinedContent, '', selectedSkills);

        if (result.passed) {
          ok('Audit Lolos! Semua dokumen konsisten.');
          await markPhaseComplete('audit', 'execute');
          printNextStep('Lanjutkan ke eksekusi dengan menjalankan:', `ceobe execute ${prefix ? prefix : ''}`.trim());
        } else {
          printError(
            'Audit Gagal',
            'Plan tidak konsisten. Silakan perbaiki berdasarkan feedback berikut:',
          );
          console.log(chalk.yellow(`\n[FEEDBACK AUDITOR]\n${result.feedback}`));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        printError('Audit gagal', msg);
        process.exit(1);
      }
    });
}
