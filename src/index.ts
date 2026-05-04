#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { env } from './config/env';
import { selectRelevantSkills, generateBRD, generateArchitecture, generateImplementationPlan, generateDesignSpec, auditPlan } from './ai/planner';
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

const program = new Command();

program
  .name('ceobe')
  .description('Ceobe CLI: An AI Engineering orchestrator. Polyglot, multi-provider, with Autonomous & Ask modes.')
  .version('1.3.0');

program
  .command('plan <description>')
  .description('Phase 1: Generate BRD, Architecture, and Task Plan for review.')
  .action(async (description: string) => {
    printModeBadge();
    console.log(chalk.blue(`Planning project with description: ${description}`));
    console.log(chalk.gray(`Workspace: ${env.TARGET_PROJECT_DIR}\n`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

      const selectedSkills = await selectRelevantSkills(description);

      const brd = await generateBRD(description, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'brd.md'), brd);

      const design = await generateDesignSpec(brd, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'design.md'), design);

      const arch = await generateArchitecture(brd, design, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'architecture.md'), arch);

      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'task.md'), plan);
      
      markPhaseComplete('plan', 'audit');
      
      console.log(chalk.magenta(`\n[Planning Phase Complete] Documents saved to .ceobe/ folder.`));
      console.log(chalk.yellow(`Please review brd.md, design.md, architecture.md, and task.md.`));
      console.log(chalk.green(`Once approved, run: npx ceobe execute\n`));
    } catch (err) {
      console.error(chalk.red('\n[Error] Project planning failed.'));
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

      const planContent = fs.readFileSync(taskPath, 'utf8');
      console.log(chalk.magenta(`\n[Execution Phase Started. Firing up Sonnet 4.6]\n`));
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
  .command('build-feature <description>')
  .description('Build a new feature following Ceobe engineering rules.')
  .action(async (description: string) => {
    printModeBadge();
    console.log(chalk.blue(`Building feature with description: ${description}`));
    console.log(chalk.gray(`Workspace: ${env.TARGET_PROJECT_DIR}\n`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

      const selectedSkills = await selectRelevantSkills(description);

      const brd = await generateBRD(description, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-brd.md'), brd);

      const design = await generateDesignSpec(brd, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-design.md'), design);

      const arch = await generateArchitecture(brd, design, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-architecture.md'), arch);

      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-task.md'), plan);
      
      markPhaseComplete('build-feature', 'audit');
      
      console.log(chalk.magenta(`\n[Feature Blueprint Complete] Documents saved to .ceobe/ folder.`));
      console.log(chalk.yellow(`Please review feature-brd.md, feature-design.md, feature-architecture.md, and feature-task.md.`));
      console.log(chalk.green(`Once approved, run: npx ceobe execute feature-task.md\n`));
    } catch (err) {
      console.error(chalk.red('\n[Error] Feature build failed.'));
      console.error(err);
    }
  });

program
  .command('auto <description>')
  .description('Run the Supervisor Agent to autonomously plan, audit, auto-correct, and execute.')
  .option('--ask', 'Ask for confirmation before executing the plan', false)
  .option('--feature', 'Run as a feature build instead of a new project', false)
  .action(async (description: string, options: { ask: boolean, feature: boolean }) => {
    await runAutonomousLoop(description, options.ask, options.feature);
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
