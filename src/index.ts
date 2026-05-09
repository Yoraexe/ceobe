#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { env } from './config/env';
import { selectRelevantSkills, generateBRD, generateArchitecture, generateImplementationPlan, generateDesignSpec, generateDevOpsConfig, auditPlan } from './ai/planner';
import { executePlan } from './ai/executor';
import { runAutonomousLoop } from './ai/supervisor';
import { indexWorkspace } from './ai/memory/indexer';
import * as fs from 'fs';
import * as path from 'path';
import { markPhaseComplete } from './utils/stateManager';
import { setMode, getActiveMode, printModeBadge, type CeobeMode } from './utils/modeManager';
import {
  setKey, removeKey, findKeyDef, printKeyTable,
  runSetupWizard, KEY_DEFINITIONS,
} from './utils/keyManager';
import { runDoctor } from './utils/doctor';

const program = new Command();

program
  .name('ceobe')
  .description('Ceobe CLI: An AI Engineering orchestrator. Polyglot, multi-provider, with Autonomous & Ask modes.')
  .version('1.3.0');

program
  .command('plan [description]')
  .description('Phase 1: Generate BRD, Architecture, and Task Plan. Use --feature for incremental builds.')
  .option('--feature', 'Plan as a new feature instead of a new project', false)
  .option('--file <path>', 'Use an external PRD/BRD file as the source')
  .action(async (description: string | undefined, options: { feature: boolean, file?: string }) => {
    printModeBadge();
    const prefix = options.feature ? 'feature-' : '';
    
    let finalDescription: string | any[] = description || '';
    if (options.file) {
      const filePath = path.isAbsolute(options.file) ? options.file : path.join(process.cwd(), options.file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`\n[Error] File tidak ditemukan: ${filePath}`));
        return;
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
      
      if (isImage) {
        console.log(chalk.blue(`Reading UI Mockup from image: ${filePath}`));
        const base64Data = fs.readFileSync(filePath).toString('base64');
        const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
        
        finalDescription = [
          { type: 'text', text: `Attached is a UI mockup/screenshot for the project requirements. Analyze this visual input along with any description provided: ${description || ''}` },
          { 
            type: 'image', 
            source: { 
              type: 'base64', 
              media_type: mimeType, 
              data: base64Data 
            } 
          }
        ];
      } else {
        console.log(chalk.blue(`Reading PRD from file: ${filePath}`));
        finalDescription = fs.readFileSync(filePath, 'utf8');
      }
    }

    if (!finalDescription || (Array.isArray(finalDescription) && finalDescription.length === 0)) {
      console.error(chalk.red('\n[Error] Silakan masukkan deskripsi atau gunakan opsi --file <path>.'));
      return;
    }

    console.log(chalk.magenta.bold(`\n🚀 [Ceobe Planner] Planning ${options.feature ? 'Feature' : 'New Project'}\n`));
    console.log(chalk.gray(`Workspace: ${process.cwd()}\n`));

    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

      const selectedSkills = await selectRelevantSkills(finalDescription);

      const brd = await generateBRD(finalDescription, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}brd.md`), brd);

      const design = await generateDesignSpec(brd, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}design.md`), design);

      const arch = await generateArchitecture(brd, design, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}architecture.md`), arch);

      const devops = await generateDevOpsConfig(arch, '', selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}devops.md`), devops);

      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}task.md`), plan);
      
      markPhaseComplete(options.feature ? 'build-feature' : 'plan', 'audit');
      
      console.log(chalk.magenta(`\n[Planning Phase Complete] Documents saved to .ceobe/ folder.`));
      console.log(chalk.yellow(`Please review ${prefix}brd.md, ${prefix}design.md, ${prefix}architecture.md, ${prefix}devops.md, and ${prefix}task.md.`));
      console.log(chalk.green(`Once approved, run: npx ceobe audit ${options.feature ? 'feature-' : ''}\n`));
    } catch (err) {
      console.error(chalk.red('\n[Error] Planning failed.'));
      console.error(err);
    }
  });

program
  .command('execute [taskFile]')
  .description('Phase 2: Execute a generated task plan (default: task.md).')
  .action(async (taskFile: string = 'task.md') => {
    printModeBadge();
    console.log(chalk.blue(`Executing plan from: .ceobe/${taskFile}`));
    
    try {
      const taskPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', taskFile);
      if (!fs.existsSync(taskPath)) {
        console.error(chalk.red(`\n[Error] Task file not found at ${taskPath}`));
        console.error(chalk.yellow(`Did you forget to run 'ceobe plan' first?\n`));
        return;
      }

      let planContent = fs.readFileSync(taskPath, 'utf8');
      
      const devopsPath = taskPath.replace('task.md', 'devops.md');
      if (fs.existsSync(devopsPath)) {
        planContent += `\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\n${fs.readFileSync(devopsPath, 'utf8')}`;
      }

      console.log(chalk.magenta(`\n[Execution Phase Started]\n`));
      await executePlan(planContent);
      
      markPhaseComplete('execute', 'done');
    } catch (err) {
      console.error(chalk.red('\n[Error] Execution failed.'));
      console.error(err);
    }
  });

program
  .command('audit [prefix]')
  .description('Phase 1.5: Audit your edited plans for conflicts before execution. Prefix is empty for new projects, or "feature-" for features.')
  .action(async (prefix: string = '') => {
    printModeBadge();
    console.log(chalk.blue(`Auditing plans in .ceobe/ folder with prefix '${prefix}'...`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      const brdPath = path.join(ceobeDir, prefix ? `${prefix}brd.md` : 'brd.md');
      const designPath = path.join(ceobeDir, prefix ? `${prefix}design.md` : 'design.md');
      const archPath = path.join(ceobeDir, prefix ? `${prefix}architecture.md` : 'architecture.md');
      const taskPath = path.join(ceobeDir, prefix ? `${prefix}task.md` : 'task.md');
      const devopsPath = path.join(ceobeDir, prefix ? `${prefix}devops.md` : 'devops.md');

      if (!fs.existsSync(brdPath) || !fs.existsSync(archPath) || !fs.existsSync(taskPath)) {
        console.error(chalk.red(`\n[Error] Missing plan files in ${ceobeDir}. Expected brd, architecture, and task files.`));
        return;
      }

      const combinedContent = `
--- BRD ---
${fs.readFileSync(brdPath, 'utf8')}
--- DESIGN ---
${fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf8') : ''}
--- ARCHITECTURE ---
${fs.readFileSync(archPath, 'utf8')}
--- DEVOPS ---
${fs.existsSync(devopsPath) ? fs.readFileSync(devopsPath, 'utf8') : ''}
--- TASK PLAN ---
${fs.readFileSync(taskPath, 'utf8')}
      `;

      // Simple heuristic: read the BRD description to guess the skills again
      const briefDescription = fs.readFileSync(brdPath, 'utf8').substring(0, 500);
      const selectedSkills = await selectRelevantSkills(briefDescription);

      const result = await auditPlan(combinedContent, selectedSkills);
      
      if (result.passed) {
        markPhaseComplete('audit', 'execute');
        console.log(chalk.green(`\nYou are cleared to run: npx ceobe execute ${prefix ? prefix + 'task.md' : ''}\n`));
      } else {
        console.log(chalk.yellow(`\nPlease fix the above issues in your markdown files, then run 'ceobe audit' again.\n`));
      }
    } catch (err) {
      console.error(chalk.red('\n[Error] Audit failed.'));
      console.error(err);
    }
  });

program
  .command('doctor')
  .description('Diagnose system health, API connectivity, and workspace status.')
  .action(async () => {
    await runDoctor();
  });

program
  .command('reset')
  .description('DANGEROUS: Clear the .ceobe/ directory and reset the workspace state.')
  .option('--yes', 'Skip confirmation prompt', false)
  .action(async (options: { yes: boolean }) => {
    const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
    if (!fs.existsSync(ceobeDir)) {
      console.log(chalk.yellow('\n[Info] Folder .ceobe/ tidak ditemukan. Workspace sudah bersih.\n'));
      return;
    }

    if (!options.yes) {
      console.log(chalk.red.bold('\n⚠️  WARNING: Ini akan menghapus SEMUA rencana, arsitektur, dan log di .ceobe/'));
      console.log(chalk.yellow('Perubahan pada source code Anda TETAP AMAN.\n'));
      // Since this is a CLI action, we'd usually use a prompt library, 
      // but for simplicity in this context we'll ask the user to use --yes
      console.log(chalk.gray('Untuk melanjutkan, jalankan: ceobe reset --yes\n'));
      return;
    }

    fs.rmSync(ceobeDir, { recursive: true, force: true });
    console.log(chalk.green('\n✅ Workspace has been reset. All plans and logs cleared.\n'));
  });

program
  .command('log')
  .description('Show the latest execution log from the workspace.')
  .action(() => {
    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    if (!fs.existsSync(logPath)) {
      console.error(chalk.red('\n[Error] No execution log found. Run ceobe execute first.\n'));
      return;
    }
    const content = fs.readFileSync(logPath, 'utf8');
    console.log(chalk.cyan('\n--- Latest Execution Logs ---\n'));
    // Show last 50 lines
    const lines = content.split('\n').slice(-50).join('\n');
    console.log(lines);
    console.log(chalk.cyan('\n----------------------------\n'));
  });

program
  .command('auto [description]')
  .description('Run the Supervisor Agent to autonomously plan, audit, auto-correct, and execute.')
  .option('--ask', 'Ask for confirmation before executing the plan', false)
  .option('--feature', 'Run as a feature build instead of a new project', false)
  .option('--file <path>', 'Use an external PRD/BRD file as the source')
  .action(async (description: string | undefined, options: { ask: boolean, feature: boolean, file?: string }) => {
    let finalDescription: string | any[] = description || '';
    if (options.file) {
      const filePath = path.isAbsolute(options.file) ? options.file : path.join(process.cwd(), options.file);
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`\n[Error] File tidak ditemukan: ${filePath}`));
        return;
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
      
      if (isImage) {
        console.log(chalk.blue(`Reading UI Mockup from image: ${filePath}`));
        const base64Data = fs.readFileSync(filePath).toString('base64');
        const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
        
        finalDescription = [
          { type: 'text', text: `Attached is a UI mockup/screenshot for the project requirements. Analyze this visual input along with any description provided: ${description || ''}` },
          { 
            type: 'image', 
            source: { 
              type: 'base64', 
              media_type: mimeType, 
              data: base64Data 
            } 
          }
        ];
      } else {
        console.log(chalk.blue(`Reading PRD from file: ${filePath}`));
        finalDescription = fs.readFileSync(filePath, 'utf8');
      }
    }

    if (!finalDescription || (Array.isArray(finalDescription) && finalDescription.length === 0)) {
      console.error(chalk.red('\n[Error] Silakan masukkan deskripsi atau gunakan opsi --file <path>.'));
      return;
    }
    await runAutonomousLoop(finalDescription, options.ask, options.feature);
  });

program
  .command('index')
  .description('Index the workspace for semantic search memory (RAG).')
  .action(async () => {
    console.log(chalk.blue(`Indexing workspace: ${env.TARGET_PROJECT_DIR}`));
    try {
      await indexWorkspace();
    } catch (err) {
      console.error(chalk.red('\n[Error] Failed to index workspace.'));
    }
  });

program
  .command('mode [newMode]')
  .description('Tampilkan atau ubah mode operasi Ceobe. Mode: autonomous (otonom) | ask (bertanya).')
  .action((newMode?: string) => {
    if (!newMode) {
      // Display current mode
      const current = getActiveMode();
      console.log(chalk.bold('\nMode Aktif Ceobe:'));
      printModeBadge();
      console.log(chalk.gray('Untuk mengubah mode, jalankan:'));
      console.log(chalk.cyan('  ceobe mode autonomous') + chalk.gray('  → Eksekusi mandiri tanpa konfirmasi'));
      console.log(chalk.cyan('  ceobe mode ask') + chalk.gray('        → Minta persetujuan sebelum setiap aksi\n'));
      return;
    }

    const validModes: CeobeMode[] = ['autonomous', 'ask'];
    if (!validModes.includes(newMode as CeobeMode)) {
      console.error(chalk.red(`[Error] Mode tidak valid: '${newMode}'. Pilih: autonomous | ask`));
      process.exit(1);
    }

    setMode(newMode as CeobeMode);
    console.log(chalk.bold('\n✅ Mode berhasil diubah!'));
    printModeBadge();
  });

// ── ceobe setup ───────────────────────────────────────────────────────────────
program
  .command('setup')
  .description('Jalankan wizard interaktif untuk mengatur semua API key yang dibutuhkan Ceobe.')
  .action(async () => {
    await runSetupWizard();
  });

// ── ceobe key ─────────────────────────────────────────────────────────────────
const keyCmd = program
  .command('key')
  .description('Kelola API key Ceobe yang tersimpan di ~/.ceobe/keys.json');

keyCmd
  .command('list')
  .description('Tampilkan semua API key yang sudah dikonfigurasi.')
  .action(() => {
    printKeyTable();
  });

keyCmd
  .command('set <provider> <value>')
  .description(
    'Simpan API key untuk provider tertentu.\n' +
    '  Provider: gemini, anthropic, glm, kimi, deepseek, groq, openai, qwen, together\n' +
    '  Contoh: ceobe key set gemini AIzaSy...'
  )
  .action((provider: string, value: string) => {
    const def = findKeyDef(provider);
    if (!def) {
      const available = KEY_DEFINITIONS.map(d => d.provider).join(', ');
      console.error(chalk.red(`[Error] Provider '${provider}' tidak dikenali.`));
      console.error(chalk.yellow(`Provider yang tersedia: ${available}`));
      process.exit(1);
    }
    setKey(def.envKey, value);
    console.log(chalk.green(`\n✅ ${def.label} (${def.envKey}) berhasil disimpan di ~/.ceobe/keys.json\n`));
  });

keyCmd
  .command('remove <provider>')
  .description('Hapus API key untuk provider tertentu dari penyimpanan Ceobe.')
  .action((provider: string) => {
    const def = findKeyDef(provider);
    if (!def) {
      console.error(chalk.red(`[Error] Provider '${provider}' tidak dikenali.`));
      process.exit(1);
    }
    const removed = removeKey(def.envKey);
    if (removed) {
      console.log(chalk.green(`\n✅ ${def.envKey} berhasil dihapus dari ~/.ceobe/keys.json\n`));
    } else {
      console.log(chalk.yellow(`\n⚠️  ${def.envKey} tidak ditemukan di penyimpanan Ceobe.\n`));
    }
  });

// Parse the arguments
program.parse(process.argv);

// If no arguments passed, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
