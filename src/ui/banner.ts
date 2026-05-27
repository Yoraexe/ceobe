// Module: src/ui/banner.ts
// Tujuan: Terminal UI helpers rendering banners, step indicators, section headers, and styled output.
// Caller: src/index.ts and command handlers.
// Dependensi: chalk, path, config/env.
// Main Functions: printBanner, printSection, printStep, ok, warn, fail, info, hint, printNextStep, printError, printHelp.
// Side Effects: Writes formatted messages directly to console stdout.

import chalk from 'chalk';
import * as path from 'path';
import { env } from '../config/env';

const VERSION = '1.8.0';

// ─────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────

export function printBanner(): void {
  const rawPlanner = process.env.CEOBE_PLANNER_PROVIDER;
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER;
  
  const plannerProvider = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;
  
  const projectDir = env.TARGET_PROJECT_DIR;
  const projectName = path.basename(projectDir);

  const plannerDisplay = plannerProvider ? chalk.cyan(plannerProvider.toUpperCase()) : chalk.yellow('(NOT SET)');
  const executorDisplay = executorProvider ? chalk.cyan(executorProvider.toUpperCase()) : chalk.yellow('(NOT SET)');

  console.log('');
  console.log(chalk.cyan.bold('  ██████╗███████╗ ██████╗ ██████╗ ███████╗'));
  console.log(chalk.cyan.bold(' ██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝'));
  console.log(chalk.cyan.bold(' ██║     █████╗  ██║   ██║██████╔╝█████╗  '));
  console.log(chalk.cyan.bold(' ██║     ██╔══╝  ██║   ██║██╔══██╗██╔══╝  '));
  console.log(chalk.cyan.bold(' ╚██████╗███████╗╚██████╔╝██████╔╝███████╗'));
  console.log(chalk.cyan.bold('  ╚═════╝╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝'));
  console.log('');
  console.log(
    chalk.gray('  Autonomous AI Engineering Orchestrator') +
    chalk.dim(` · v${VERSION}`)
  );
  console.log(
    chalk.dim(`  🧠 Planner: ${plannerDisplay}`) +
    chalk.dim(`  ·  ⚙️  Executor: ${executorDisplay}`) +
    chalk.dim(`  ·  📂 ${chalk.white(projectName)}`)
  );
  if (!plannerProvider || !executorProvider) {
    console.log(chalk.yellow(`\n  ⚠️  Provider belum dikonfigurasi. Jalankan ${chalk.bold('ceobe setup')} atau ${chalk.bold('ceobe key set planner-provider <name>')}`));
  }
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// Section separator
// ─────────────────────────────────────────────────────────────

export function printSection(title: string, icon = '◆'): void {
  const line = '─'.repeat(50);
  console.log('');
  console.log(chalk.bold.cyan(`  ${icon} ${title}`));
  console.log(chalk.dim(`  ${line}`));
}

// ─────────────────────────────────────────────────────────────
// Step progress
// ─────────────────────────────────────────────────────────────

export function printStep(step: number, total: number, label: string): void {
  const filled = '█'.repeat(step);
  const empty = '░'.repeat(total - step);
  const pct = Math.round((step / total) * 100);
  const bar = chalk.cyan(filled) + chalk.dim(empty);
  console.log(`\n  [${bar}] ${chalk.bold.white(pct + '%')}  ${chalk.gray('Step')} ${chalk.cyan(step + '/' + total)}  ${chalk.white(label)}`);
}

// ─────────────────────────────────────────────────────────────
// Status messages
// ─────────────────────────────────────────────────────────────

export function ok(msg: string): void {
  console.log(chalk.green(`  ✅  ${msg}`));
}

export function warn(msg: string): void {
  console.log(chalk.yellow(`  ⚠️   ${msg}`));
}

export function fail(msg: string): void {
  console.log(chalk.red(`  ✗  ${msg}`));
}

export function info(msg: string): void {
  console.log(chalk.cyan(`  ℹ  ${msg}`));
}

export function hint(msg: string): void {
  console.log(chalk.dim(`     → ${msg}`));
}

// ─────────────────────────────────────────────────────────────
// Next-step suggestion box
// ─────────────────────────────────────────────────────────────

export function printNextStep(label: string, command: string): void {
  const maxLen = 46;
  const labelTrunc = label.length > maxLen ? label.substring(0, maxLen - 1) : label;
  const cmdStr = '$ ' + command;
  const cmdTrunc = cmdStr.length > maxLen ? cmdStr.substring(0, maxLen - 1) : cmdStr;
  console.log('');
  console.log(chalk.bold('  ╔═══ Next Step ════════════════════════════════╗'));
  console.log(`  ║  ${labelTrunc.padEnd(maxLen)}║`);
  console.log(`  ║  ${chalk.cyan.bold(cmdTrunc.padEnd(maxLen))}║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// Error box
// ─────────────────────────────────────────────────────────────

export function printError(title: string, detail?: string, fix?: string): void {
  console.log('');
  console.log(chalk.red.bold(`  ✗ ${title}`));
  if (detail) console.log(chalk.dim(`    ${detail}`));
  if (fix)    console.log(chalk.yellow(`    Fix: ${fix}`));
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// Custom help screen
// ─────────────────────────────────────────────────────────────

export function printHelp(): void {
  printBanner();

  console.log(chalk.bold('  USAGE'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('ceobe')} ${chalk.white('<command>')} ${chalk.gray('[options]')}\n`);

  const cmds: [string, string, string?][] = [
    ['🤖  auto',    '"Build a REST API in Go"',  'Full autonomous pipeline (plan→audit→execute)'],
    ['📋  plan',    '"Landing page with auth"',   'Generate BRD, design, architecture & task plan'],
    ['🔍  audit',   '',                           'QA-check the plan before execution'],
    ['🚀  execute', '',                           'Execute the approved task plan'],
    ['📊  status',  '',                           'Show pipeline progress & plan files'],
    ['🧠  index',   '',                           'Index workspace for semantic memory (RAG)'],
    ['🩺  doctor',  '',                           'Diagnose API keys, providers & workspace'],
    ['🔑  key',     'set/get/list/remove',         'Manage API keys & provider config'],
    ['🔄  mode',    'autonomous | ask',            'Switch execution mode'],
    ['📝  log',     '[-n <lines>]',               'Show latest execution log'],
    ['🔃  setup',   '',                           'Interactive first-time setup wizard'],
    ['💣  reset',   '--yes',                      'Clear all plans and state files'],
  ];

  console.log(chalk.bold('  COMMANDS'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────'));
  for (const [cmd, arg, desc] of cmds) {
    console.log(
      `  ${chalk.cyan(cmd.padEnd(17))} ${chalk.gray(arg.padEnd(26))} ${desc ? chalk.dim(desc) : ''}`
    );
  }

  console.log('');
  console.log(chalk.bold('  KEY MANAGEMENT'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('ceobe key list')}               ${chalk.dim('Lihat semua key & provider aktif')}`);
  console.log(`  ${chalk.cyan('ceobe key set <prov> <val>')}   ${chalk.dim('Simpan API key atau config provider')}`);
  console.log(`  ${chalk.cyan('ceobe key get <prov>')}         ${chalk.dim('Cek nilai key (tersensor) untuk provider')}`);
  console.log(`  ${chalk.cyan('ceobe key remove <prov>')}      ${chalk.dim('Hapus API key dari penyimpanan')}`);
  console.log(`  ${chalk.dim('  Provider: gemini · anthropic · deepseek · glm · kimi · groq · openai · ollama')}`);
  console.log(`  ${chalk.dim('  Config  : planner-provider · executor-provider · planner-model · executor-model')}`);

  console.log('');
  console.log(chalk.bold('  QUICK START'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────'));
  console.log(`  ${chalk.dim('1.')} ${chalk.cyan('ceobe setup')}                  ${chalk.dim('Configure your API keys')}`);
  console.log(`  ${chalk.dim('2.')} ${chalk.cyan('ceobe auto "your idea"')}       ${chalk.dim('Let Ceobe build it fully autonomously')}`);
  console.log(`  ${chalk.dim('   or')}`);
  console.log(`  ${chalk.dim('2.')} ${chalk.cyan('ceobe plan "your idea"')}       ${chalk.dim('Generate plan for manual review')}`);
  console.log(`  ${chalk.dim('3.')} ${chalk.cyan('ceobe audit')}                  ${chalk.dim('Verify plan integrity')}`);
  console.log(`  ${chalk.dim('4.')} ${chalk.cyan('ceobe execute')}                ${chalk.dim('Build the project')}`);
  console.log('');
  console.log(chalk.dim(`  Docs & source: https://github.com/your-repo/ceobe`));
  console.log('');
}
