// Tujuan: Membantu merender elemen UI terminal seperti banner, indikator langkah, header bagian, dan keluaran bergaya.
// Caller: src/index.ts dan berbagai file perintah CLI.
// Dependensi: chalk, path, utils/context.
// Main Functions: printBanner, printSection, printStep, ok, warn, fail, info, hint, printNextStep, printError, printHelp.
// Side Effects: Menulis pesan berformat secara langsung ke standard output (console.log).
// v1.0.0: Terminal UI Helpers.

import { getProjectDir } from '../utils/context';

import chalk from 'chalk';
import * as path from 'path';

export const APP_NAME = 'Ceobe Mastery CLI';
export const VERSION = '1.11.0';

// ─────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────

export function printBanner(): void {
  const rawPlanner = process.env.CEOBE_PLANNER_PROVIDER;
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER;
  
  const plannerProvider = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;
  
  let projectName = 'default';
  try {
    const projectDir = getProjectDir();
    projectName = path.basename(projectDir);
  } catch (e) {
    // Graceful fallback if getProjectDir throws outside active context
  }

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
    chalk.dim(` · v${VERSION} [V3 Engine]`)
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
    ['📡  daemon',  '--telegram',                 'Start Ceobe as a remote Telegram bot'],
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
  console.log(chalk.bold('  TELEGRAM COMMANDS (When running daemon --telegram)'));
  console.log(chalk.dim('  ─────────────────────────────────────────────────'));
  console.log(`  ${chalk.cyan('/start')}                       ${chalk.dim('Wake up the bot and check status')}`);
  console.log(`  ${chalk.cyan('/projects')}                    ${chalk.dim('List all your active workspaces')}`);
  console.log(`  ${chalk.cyan('/addproject <name> <path>')}    ${chalk.dim('Register a new workspace')}`);
  console.log(`  ${chalk.cyan('/cd <name>')}                   ${chalk.dim('Switch to a specific workspace')}`);
  console.log(`  ${chalk.cyan('/cost')}                        ${chalk.dim('View live API token usage & costs')}`);
  console.log(`  ${chalk.cyan('/status')}                      ${chalk.dim('Check current pipeline status')}`);
  console.log(`  ${chalk.cyan('/logs')}                        ${chalk.dim('Tail the last 50 lines of execution logs')}`);
  console.log(`  ${chalk.cyan('/read <file>')}                 ${chalk.dim('Read project files directly via chat')}`);
  console.log(`  ${chalk.cyan('/mode <ask|autonomous>')}       ${chalk.dim('Set manual confirmation or full autonomy')}`);
  console.log(`  ${chalk.cyan('/ask | /auto')}                 ${chalk.dim('Shortcuts to change execution mode')}`);
  console.log(`  ${chalk.cyan('/cancel')}                      ${chalk.dim('Clear the task queue and stop execution')}`);
  console.log(`  ${chalk.dim('  * Any normal message will be treated as an instruction for Ceobe.')}`);

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
