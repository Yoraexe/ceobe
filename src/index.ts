#!/usr/bin/env node

// Module: src/index.ts
// Tujuan: Main entrypoint defining CLI commands and orchestrating autonomous workflows.
// Caller: Executed directly via terminal CLI.
// Dependensi: commander, chalk, config/env, ai/planner, ai/executor, ai/supervisor, ui/banner, telegram/telegramDaemon.
// Main Functions: CLI route handlers for auto, plan, audit, execute, status, reset, key, mode, doctor, index, daemon.
// Side Effects: Reads/writes filesystem files, initiates network communication, manages console process output.
// v1.7.0: Fase 5 — flag --sandbox mengaktifkan Docker Execution Sandbox via CEOBE_SANDBOX=docker.

import { Command } from 'commander';
import chalk from 'chalk';

import { env } from './config/env';
import {
  selectRelevantSkills, generateBRD, generateArchitecture,
  generateImplementationPlan, generateDesignSpec,
  generateDevOpsConfig, auditPlan
} from './ai/planner';
import { executePlan } from './ai/executor';
import { runAutonomousLoop } from './ai/supervisor';
import { indexWorkspace } from './ai/memory/indexer';
import * as fs from 'fs';
import * as path from 'path';
import { markPhaseComplete } from './utils/stateManager';
import { setMode, printModeBadge, type CeobeMode } from './utils/modeManager';
import {
  setKey, removeKey, findKeyDef, printKeyTable, maskKey,
  runSetupWizard, KEY_DEFINITIONS, readAllKeys,
} from './utils/keyManager';
import { runDoctor } from './utils/doctor';
import {
  printBanner, printSection, printStep, ok, warn, info, hint,
  printNextStep, printError, printHelp
} from './ui/banner';
import { getCostSummary } from './utils/costTracker';
import { startTelegramDaemon } from './telegram/telegramDaemon';

const VERSION = '1.8.1';
const program = new Command();

/**
 * Activates Docker sandbox mode by setting CEOBE_SANDBOX=docker in process.env.
 * The existing wrapInSandbox() in systemTools.ts reads this variable automatically.
 */
function activateSandbox(): void {
  process.env['CEOBE_SANDBOX'] = 'docker';
  info('🐳 Sandbox Mode aktif — eksekusi diisolasi dalam Docker container.');
}

// ── Suppress default help in favour of our custom one ─────────────────────────
program
  .name('ceobe')
  .description('Ceobe — Autonomous AI Engineering Orchestrator')
  .version(VERSION, '-v, --version', 'Show Ceobe version')
  .helpOption(false) // We render our own
  .addHelpCommand(false);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: resolve file input (text or image) for plan/auto commands
// ─────────────────────────────────────────────────────────────────────────────
function resolveFileInput(filePath: string, description?: string): string | object[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    printError('File tidak ditemukan', abs, `Periksa path file Anda`);
    process.exit(1);
  }
  const ext = path.extname(abs).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    info(`Membaca UI Mockup dari: ${chalk.white(abs)}`);
    const base64Data = fs.readFileSync(abs).toString('base64');
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return [
      { type: 'text', text: `UI mockup attached. Analyze and use as project requirements. Extra context: ${description || ''}` },
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
    ];
  }
  info(`Membaca PRD dari file: ${chalk.white(abs)}`);
  return fs.readFileSync(abs, 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// ceobe auto — Full autonomous pipeline
// ─────────────────────────────────────────────────────────────────────────────
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

    await runAutonomousLoop(finalDescription as any, options.ask, options.feature);
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe plan — Generate planning documents
// ─────────────────────────────────────────────────────────────────────────────
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
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
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
      const devops = await generateDevOpsConfig(arch, '', selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}devops.md`), devops);
      ok(`Architecture & DevOps tersimpan → ${chalk.cyan(`.ceobe/${prefix}architecture.md`)}`);

      printStep(5, TOTAL_STEPS, 'Membuat Implementation Task Plan...');
      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, `${prefix}task.md`), plan);
      ok(`Task Plan tersimpan → ${chalk.cyan(`.ceobe/${prefix}task.md`)}`);

      markPhaseComplete(options.feature ? 'build-feature' : 'plan', 'audit');

      printSection('✅ Planning Selesai!');
      console.log(chalk.dim(`  Semua dokumen tersimpan di folder ${chalk.white('.ceobe/')}`));
      console.log(chalk.dim(`  Review dan edit file-file berikut sesuai kebutuhan:`));
      console.log(chalk.dim(`  ${['brd.md', 'design.md', 'architecture.md', 'devops.md', 'task.md'].map(f => chalk.cyan(prefix + f)).join('  ·  ')}`));
      printNextStep('Setelah review, jalankan audit untuk verifikasi plan:', `ceobe audit ${prefix ? '-- ' + prefix : ''}`);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      printError('Planning gagal', msg);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe audit — QA audit plan
// ─────────────────────────────────────────────────────────────────────────────
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
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
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
      const result = await auditPlan(combinedContent, selectedSkills);

      if (result.passed) {
        markPhaseComplete('audit', 'execute');
        printSection('✅ Audit Lulus!');
        ok('Semua plan sudah konsisten dan siap dieksekusi.');
        printNextStep('Jalankan executor untuk memulai pembangunan:', `ceobe execute ${prefix ? prefix + 'task.md' : ''}`);
      } else {
        printSection('⚠️  Audit Menemukan Masalah');
        warn('Perbaiki masalah di atas pada file markdown Anda, lalu jalankan audit lagi.');
        hint('ceobe audit');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      printError('Audit gagal', msg);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe execute — Execute task plan
// ─────────────────────────────────────────────────────────────────────────────
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
      const taskPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', taskFile);
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

      await executePlan(planContent);
      markPhaseComplete('execute', 'done');

      printSection('🎉 Eksekusi Selesai!');
      ok('Proyek berhasil dibangun oleh Ceobe.');
      hint('Jalankan `ceobe log` untuk melihat detail log eksekusi.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      printError('Eksekusi gagal', msg);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe index
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('index')
  .description('🧠  Index workspace untuk semantic memory (RAG)')
  .action(async () => {
    printBanner();
    printSection('🧠 Mengindeks Workspace...');
    info(`Target: ${chalk.cyan(env.TARGET_PROJECT_DIR)}`);
    try {
      await indexWorkspace();
      ok('Workspace berhasil diindeks. Ceobe kini memiliki memori semantik proyek ini.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      printError('Indexing gagal', msg);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe doctor
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('🩺  Diagnosa API key, provider, dan status workspace')
  .action(async () => {
    printBanner();
    await runDoctor();
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe mode
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('mode [newMode]')
  .description('🔄  Lihat atau ubah mode eksekusi Ceobe')
  .addHelpText('after', `
  Mode yang tersedia:
    autonomous   Ceobe bekerja penuh otomatis tanpa jeda
    ask          Ceobe minta persetujuan sebelum setiap aksi destruktif

  Contoh:
    ceobe mode              ← tampilkan mode aktif
    ceobe mode autonomous
    ceobe mode ask
`)
  .action((newMode?: string) => {
    if (!newMode) {
      printBanner();
      printSection('🔄 Mode Aktif');
      printModeBadge();
      console.log('');
      info('Ubah mode dengan: ' + chalk.cyan('ceobe mode autonomous') + ' atau ' + chalk.cyan('ceobe mode ask'));
      return;
    }

    const validModes: CeobeMode[] = ['autonomous', 'ask'];
    if (!validModes.includes(newMode as CeobeMode)) {
      printError(`Mode tidak valid: '${newMode}'`, 'Pilih salah satu dari: autonomous | ask', 'ceobe mode autonomous');
      process.exit(1);
    }
    setMode(newMode as CeobeMode);
    console.log('');
    ok(`Mode diubah ke: ${chalk.bold.cyan(newMode)}`);
    printModeBadge();
    console.log('');
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe setup
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('setup')
  .description('🔃  Wizard interaktif untuk konfigurasi pertama kali')
  .action(async () => {
    printBanner();
    await runSetupWizard();
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe log
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('log')
  .description('📝  Tampilkan log eksekusi terbaru')
  .option('-n <lines>', 'Jumlah baris terakhir yang ditampilkan', '80')
  .action((options: { n: string }) => {
    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    if (!fs.existsSync(logPath)) {
      printError(
        'Log tidak ditemukan',
        'Belum ada eksekusi yang dijalankan di workspace ini.',
        'ceobe execute'
      );
      return;
    }
    const n = parseInt(options.n || '80', 10);
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').slice(-n);
    const logSize = (fs.statSync(logPath).size / 1024).toFixed(1);

    console.log('');
    console.log(chalk.bold.cyan(`  ═══ Execution Log · ${logSize} KB · (${lines.length} baris terakhir) ════`));
    console.log('');
    lines.forEach(line => {
      if (line.includes('[Error]') || line.includes('ERROR')) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.includes('✅') || line.includes('SUCCESS')) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.includes('[Tool]') || line.includes('TOOL')) {
        console.log(chalk.cyan(`  ${line}`));
      } else {
        console.log(chalk.dim(`  ${line}`));
      }
    });
    console.log('');
    console.log(chalk.dim(`  ═══════════════════════════════════════════════════`));
    console.log('');
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe status — Show current pipeline phase
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('📊  Tampilkan status pipeline & progress proyek saat ini')
  .action(() => {
    printBanner();
    printSection('📊 Status Pipeline Proyek');
    const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');

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

// ─────────────────────────────────────────────────────────────────────────────
// ceobe reset
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('reset')
  .description('💣  Hapus semua plan & state Ceobe di workspace ini')
  .option('--yes', 'Konfirmasi otomatis tanpa prompt')
  .action((options: { yes: boolean }) => {
    const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
    if (!fs.existsSync(ceobeDir)) {
      warn('Folder .ceobe/ tidak ditemukan. Workspace sudah bersih.');
      return;
    }

    if (!options.yes) {
      console.log('');
      console.log(chalk.red.bold('  ╔═══ ⚠️  PERINGATAN ══════════════════════════════════════╗'));
      console.log(chalk.red('  ║  Ini akan menghapus SEMUA plan, arsitektur, state        ║'));
      console.log(chalk.red('  ║  dan log di folder .ceobe/                               ║'));
      console.log(chalk.yellow('  ║  Source code proyekmu TETAP AMAN.                        ║'));
      console.log(chalk.red.bold('  ╚════════════════════════════════════════════════════════╝'));
      console.log('');
      hint('Untuk melanjutkan: ' + chalk.cyan('ceobe reset --yes'));
      console.log('');
      return;
    }

    fs.rmSync(ceobeDir, { recursive: true, force: true });
    console.log('');
    ok('Workspace berhasil di-reset. Semua plan dan log telah dihapus.');
    hint('Mulai ulang dengan: ceobe plan "Deskripsi proyekmu"');
    console.log('');
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe key — API Key management
// ─────────────────────────────────────────────────────────────────────────────
const keyCmd = program
  .command('key')
  .description('🔑  Kelola API key & konfigurasi provider Ceobe');

keyCmd
  .command('list')
  .description('Tampilkan semua API key & provider yang dikonfigurasi')
  .action(() => {
    printBanner();
    printKeyTable();
  });

keyCmd
  .command('set <provider> <value>')
  .description('Simpan API key atau konfigurasi untuk provider tertentu')
  .addHelpText('after', `
  Provider API key:
    gemini, anthropic, glm, kimi, deepseek, groq, openai, qwen, together

  Konfigurasi provider (tidak butuh API key):
    planner-provider   → Provider untuk Planner (gemini / deepseek / glm / ...)
    executor-provider  → Provider untuk Executor (claude / deepseek / glm / ...)
    qa-provider        → Provider untuk QA Auditor (gemini / claude / ...)
    planner-model        → Override model Planner
    executor-model       → Override model Executor
    qa-model             → Override model QA Auditor

  Contoh:
    ceobe key set gemini AIzaSy...
    ceobe key set planner-provider deepseek
    ceobe key set executor-provider glm
    ceobe key set qa-provider gemini
    ceobe key set qa-model gemini-2.5-flash
`)
  .action((provider: string, value: string) => {
    const def = findKeyDef(provider);
    if (!def) {
      const available = KEY_DEFINITIONS.map(d => d.provider).join(', ');
      printError(
        `Provider '${provider}' tidak dikenali`,
        `Provider yang tersedia: ${available}`,
        `ceobe key set <provider> <value>`
      );
      process.exit(1);
    }
    setKey(def.envKey, value);
    console.log('');
    ok(`${chalk.bold(def.label)} berhasil disimpan.`);
    hint(`Key tersimpan di ~/.ceobe/keys.json`);
    if (def.envKey.includes('PROVIDER')) {
      hint(`Jalankan ${chalk.cyan('ceobe doctor')} untuk memverifikasi konfigurasi baru Anda.`);
    }
    console.log('');
  });

keyCmd
  .command('get <provider>')
  .description('Tampilkan nilai API key untuk provider tertentu (tersensor)')
  .action((provider: string) => {
    const def = findKeyDef(provider);
    if (!def) {
      printError(`Provider '${provider}' tidak dikenali`);
      process.exit(1);
    }
    const stored = readAllKeys();
    const value = stored[def.envKey] || process.env[def.envKey] || '';
    console.log('');
    if (value) {
      const source = stored[def.envKey] ? chalk.green('ceobe key store') : chalk.gray('system env / .env');
      ok(`${chalk.bold(def.label)}`);
      console.log(`     ${chalk.dim('Key    :')} ${chalk.cyan(maskKey(value))}`);
      console.log(`     ${chalk.dim('Source :')} ${source}`);
      console.log(`     ${chalk.dim('Env Var:')} ${def.envKey}`);
    } else {
      warn(`${def.label} belum dikonfigurasi.`);
      hint(`Atur dengan: ceobe key set ${def.provider} <value>`);
      hint(`Dapatkan key di: ${def.docsUrl}`);
    }
    console.log('');
  });

keyCmd
  .command('remove <provider>')
  .description('Hapus API key untuk provider tertentu')
  .action((provider: string) => {
    const def = findKeyDef(provider);
    if (!def) {
      printError(`Provider '${provider}' tidak dikenali`);
      process.exit(1);
    }
    const removed = removeKey(def.envKey);
    console.log('');
    if (removed) {
      ok(`${def.envKey} berhasil dihapus dari ~/.ceobe/keys.json`);
    } else {
      warn(`${def.envKey} tidak ditemukan di penyimpanan Ceobe.`);
    }
    console.log('');
  });

// ─────────────────────────────────────────────────────────────────────────────
// ceobe daemon — Remote orchestration via Telegram
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('daemon')
  .description('📡  Jalankan Ceobe sebagai daemon remote (Telegram Bot)')
  .option('--telegram', 'Gunakan Telegram sebagai interface remote')
  .addHelpText('after', `
  Setup awal:
    ceobe key set telegram-token <BOT_TOKEN_DARI_BOTFATHER>
    ceobe key set telegram-allowed-users <USER_ID_KAMU>

  Cara dapat User ID kamu:
    Kirim pesan ke @userinfobot di Telegram.

  Contoh:
    ceobe daemon --telegram
`)
  .action(async (options: { telegram: boolean }) => {
    printBanner();
    if (!options.telegram) {
      printError(
        'Interface diperlukan',
        'Tentukan interface daemon yang ingin digunakan.',
        'ceobe daemon --telegram'
      );
      process.exit(1);
    }
    await startTelegramDaemon();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Help & default (no args)
// ─────────────────────────────────────────────────────────────────────────────
program
  .command('help')
  .description('Tampilkan panduan lengkap Ceobe')
  .action(() => {
    printHelp();
  });

program.action(() => {
  printHelp();
});

// Parse args
program.parse(process.argv);
