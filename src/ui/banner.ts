// Tujuan: Merender elemen UI terminal Ceobe — banner animasi, progress bar, section header, dan pesan bergaya.
// Caller: src/index.ts dan berbagai file perintah CLI.
// Dependensi: chalk, path, utils/context.
// Main Functions: printBanner, printBannerSync, printSection, printStep, ok, warn, fail, info, hint, printNextStep, printError, printHelp.
// Side Effects: Menulis output berformat ke stdout. Animasi menggunakan setInterval/setTimeout.
// v2.0.0: Minimalist + Animated Terminal UI Redesign.

import { getProjectDir } from '../utils/context';
import chalk from 'chalk';
import * as path from 'path';
import packageJson from '../../package.json';

export const VERSION = packageJson.version || '1.16.0';

// ─────────────────────────────────────────────────────────────
// Palette — Satu warna utama + aksen abu
// ─────────────────────────────────────────────────────────────

const C = {
  primary:   chalk.hex('#7ECFE0'),   // soft cyan
  accent:    chalk.hex('#4FC3D9'),   // bright cyan
  dim:       chalk.hex('#3D5A66'),   // dark slate
  muted:     chalk.hex('#566D75'),   // muted gray-blue
  white:     chalk.hex('#E8F4F7'),   // off-white
  green:     chalk.hex('#6DCEA8'),   // soft green
  yellow:    chalk.hex('#F5C866'),   // warm amber
  red:       chalk.hex('#F07070'),   // soft red
  purple:    chalk.hex('#A78FD4'),   // soft purple
  bg:        chalk.bgHex('#0D1B20'), // dark bg (for badges)
};

// ─────────────────────────────────────────────────────────────
// Animated Boot Sequence
// ─────────────────────────────────────────────────────────────

const LOGO_LINES = [
  '  ░█████╗░███████╗░█████╗░██████╗░███████╗',
  '  ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝',
  '  ██║░░╚═╝█████╗░░██║░░██║██████╦╝█████╗░░',
  '  ██║░░██╗██╔══╝░░██║░░██║██╔══██╗██╔══╝░░',
  '  ╚█████╔╝███████╗╚█████╔╝██████╦╝███████╗',
  '  ░╚════╝░╚══════╝░╚════╝░╚═════╝░╚══════╝',
];

const TAGLINE   = 'Autonomous AI Engineering Orchestrator';
const SUB_TAG   = 'Three Brains · 288 Skills · Model-Agnostic';

/**
 * Animasi typewriter satu baris ke stdout (sync sleep via busy-wait).
 * Digunakan hanya saat banner pertama kali tampil.
 */
function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy-wait — intentional for CLI animation */ }
}

function writeChar(char: string, color: (s: string) => string = (s) => s): void {
  process.stdout.write(color(char));
}

/**
 * Banner animasi — cocok dipanggil sekali di entry point.
 * Gunakan printBanner() untuk semua command biasa (non-animasi, instant).
 */
export async function printAnimatedBanner(): Promise<void> {
  console.clear();
  console.log('');

  // ── Phase 1: Render logo line by line dengan fade-in ──────
  for (let i = 0; i < LOGO_LINES.length; i++) {
    const line = LOGO_LINES[i];
    // Gradient efek: baris atas lebih dim, bawah lebih terang
    const brightness = ['#2A6A7A', '#3A8A9A', '#4AACBE', '#5ABECE', '#6ACCDB', '#7ECFE0'];
    const color = chalk.hex(brightness[i] || '#7ECFE0').bold;
    console.log(color(line));
    sleepSync(55);
  }

  console.log('');

  // ── Phase 2: Typewriter tagline ───────────────────────────
  process.stdout.write('  ');
  for (const char of TAGLINE) {
    writeChar(char, C.white.bold);
    sleepSync(18);
  }
  process.stdout.write('\n');

  // ── Phase 3: Sub-tag dim ──────────────────────────────────
  process.stdout.write('  ');
  for (const char of SUB_TAG) {
    writeChar(char, C.muted);
    sleepSync(10);
  }
  process.stdout.write('\n');

  // ── Phase 4: Separator "breathing" ────────────────────────
  console.log('');
  const sep = '  ' + '─'.repeat(44);
  for (let i = 0; i < sep.length; i++) {
    writeChar(sep[i], C.dim);
    sleepSync(4);
  }
  process.stdout.write('\n');

  // ── Phase 5: Provider info + version ──────────────────────
  _printProviderLine();
  console.log('');
}

/**
 * Banner INSTANT — digunakan oleh semua command (status, key, dll.)
 * Tidak ada animasi, langsung render.
 */
export function printBanner(): void {
  const rawPlanner  = process.env.CEOBE_PLANNER_PROVIDER;
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER;
  const plannerProvider  = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;

  let projectName = 'default';
  try {
    projectName = path.basename(getProjectDir());
  } catch { /* graceful */ }

  console.log('');
  // Compact wordmark — single line, bold
  console.log(
    C.accent.bold('  ◈ CEOBE') +
    C.dim(` v${VERSION}`) +
    '  ' +
    C.muted('─') +
    '  ' +
    C.muted(TAGLINE)
  );

  // Separator
  console.log(C.dim('  ' + '─'.repeat(54)));

  // Provider status
  const pl = plannerProvider  ? C.primary(plannerProvider.toUpperCase())  : C.yellow('(unset)');
  const ex = executorProvider ? C.primary(executorProvider.toUpperCase()) : C.yellow('(unset)');

  console.log(
    C.muted('  𝙿 ') + pl +
    C.muted('  ·  𝙴 ') + ex +
    C.muted('  ·  ') +
    C.dim('📂 ' + projectName)
  );

  if (!plannerProvider || !executorProvider) {
    console.log(
      C.yellow(`\n  ⚡ Provider belum diset — jalankan `) +
      C.accent.bold('ceobe setup')
    );
  }
  console.log('');
}

function _printProviderLine(): void {
  const rawPlanner  = process.env.CEOBE_PLANNER_PROVIDER;
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER;
  const plannerProvider  = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;

  let projectName = 'default';
  try { projectName = path.basename(getProjectDir()); } catch { /* ok */ }

  const pl = plannerProvider  ? C.accent(plannerProvider.toUpperCase())  : C.yellow('—');
  const ex = executorProvider ? C.accent(executorProvider.toUpperCase()) : C.yellow('—');

  console.log(
    C.muted(`  version `) + C.dim(`v${VERSION}`) +
    C.muted('  ·  𝙿 ') + pl +
    C.muted('  𝙴 ') + ex +
    C.muted('  📂 ') + C.dim(projectName)
  );

  if (!plannerProvider || !executorProvider) {
    console.log(C.yellow(`\n  ⚡ Run `) + C.accent.bold('ceobe setup') + C.yellow(' to configure providers'));
  }
}

// ─────────────────────────────────────────────────────────────
// Section separator
// ─────────────────────────────────────────────────────────────

export function printSection(title: string, _icon = '◆'): void {
  console.log('');
  console.log(C.accent.bold(`  ▸ ${title}`));
  console.log(C.dim('  ' + '─'.repeat(48)));
}

// ─────────────────────────────────────────────────────────────
// Step / Progress bar
// ─────────────────────────────────────────────────────────────

export function printStep(step: number, total: number, label: string): void {
  const filled = '█'.repeat(step);
  const empty  = '░'.repeat(total - step);
  const pct    = Math.round((step / total) * 100);
  const bar    = C.accent(filled) + C.dim(empty);
  console.log(
    `\n  [${bar}] ` +
    C.white.bold(`${pct}%`) +
    C.muted(`  ${step}/${total}`) +
    '  ' +
    C.white(label)
  );
}

// ─────────────────────────────────────────────────────────────
// Status messages
// ─────────────────────────────────────────────────────────────

export function ok(msg: string): void {
  console.log(C.green(`  ✓  ${msg}`));
}

export function warn(msg: string): void {
  console.log(C.yellow(`  ▲  ${msg}`));
}

export function fail(msg: string): void {
  console.log(C.red(`  ✗  ${msg}`));
}

export function info(msg: string): void {
  console.log(C.primary(`  ·  ${msg}`));
}

export function hint(msg: string): void {
  console.log(C.muted(`     ↳ ${msg}`));
}

// ─────────────────────────────────────────────────────────────
// Next-step box  — compact bordered
// ─────────────────────────────────────────────────────────────

export function printNextStep(label: string, command: string): void {
  const W = 48;
  const pad = (s: string) => s.length >= W ? s.substring(0, W - 1) : s.padEnd(W);
  console.log('');
  console.log(C.dim(`  ┌${'─'.repeat(W + 2)}┐`));
  console.log(C.dim(`  │ `) + C.muted(pad(label))             + C.dim(' │'));
  console.log(C.dim(`  │ `) + C.accent.bold(pad('$ ' + command)) + C.dim(' │'));
  console.log(C.dim(`  └${'─'.repeat(W + 2)}┘`));
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// Error box
// ─────────────────────────────────────────────────────────────

export function printError(title: string, detail?: string, fix?: string): void {
  console.log('');
  console.log(C.red(`  ✗ ${title}`));
  if (detail) console.log(C.muted(`    ${detail}`));
  if (fix)    console.log(C.yellow(`    → ${fix}`));
  console.log('');
}

// ─────────────────────────────────────────────────────────────
// printModeBadge — used by modeCmd
// ─────────────────────────────────────────────────────────────

// Re-export setMode so callers don't need to import modeManager directly
export { setMode, printModeBadge } from '../utils/modeManager';

// ─────────────────────────────────────────────────────────────
// Help screen  — complete, polished
// ─────────────────────────────────────────────────────────────

export function printHelp(skipBanner = false): void {
  if (!skipBanner) printBanner();

  const row = (cmd: string, arg: string, desc: string) =>
    `  ${C.accent(cmd.padEnd(18))} ${C.muted(arg.padEnd(24))} ${C.dim(desc)}`;

  // ── CORE ──────────────────────────────────────────────────
  printSection('CORE COMMANDS');
  console.log(row('auto [desc]',    '[--ask|--feature|--file|--sandbox|--worktree|--creative]', 'Full autonomous pipeline'));
  console.log(row('plan [desc]',    '[--file <path>]',     'Generate BRD + design + architecture + task plan'));
  console.log(row('execute',        '',                    'Run the approved task plan'));
  console.log(row('export-rules',   '',                    'Sync engineering rules to Cursor / Windsurf / Cline'));

  // ── WORKSPACE ─────────────────────────────────────────────
  printSection('WORKSPACE');
  console.log(row('status',         '',                    'Show pipeline progress, phases & plan files'));
  console.log(row('index',          '',                    'Build semantic memory index (RAG)'));
  console.log(row('trim',           '',                    'Whole-repo bloat scanner — detect over-engineering'));
  console.log(row('debt',           '',                    'Scan tech-debt markers (// ceobe: / // ponytail:)'));
  console.log(row('reflect',        '[--auto-skill]',      'Analyze execution logs, auto-generate skill draft'));
  console.log(row('rollback',       '',                    'Hard-reset to pre-AI git snapshot'));
  console.log(row('reset',          '--yes',               'Clear all plans & pipeline state'));
  console.log(row('recon <url>',    '[--depth] [--focus]', 'Dynamic reverse-engineering of a URL'));

  // ── CONFIG ────────────────────────────────────────────────
  printSection('CONFIGURATION');
  console.log(row('setup',          '',                    'Interactive first-time setup wizard'));
  console.log(row('key set',        '<provider> <value>',  'Save an API key or provider config'));
  console.log(row('key list',       '',                    'Show all keys & active provider config'));
  console.log(row('key get',        '<provider>',          'Peek at a single key (masked)'));
  console.log(row('key remove',     '<provider>',          'Delete a stored key'));
  console.log(row('mode',           '[autonomous|ask]',    'View or change execution mode'));
  console.log(row('doctor',         '',                    'Diagnose API keys, providers & workspace'));

  // ── ADVANCED ──────────────────────────────────────────────
  printSection('ADVANCED');
  console.log(row('benchmark',      '',                    'LLM benchmark — compare accuracy & token efficiency'));
  console.log(row('log',            '[-n <lines>]',        'View execution log output'));
  console.log(row('daemon',         '--telegram',          'Start Ceobe as a remote Telegram bot'));
  console.log(row('mcp',            '',                    'Launch MCP stdio server (for AI IDE integrations)'));
  console.log(row('skill list',     '',                    'Browse all 288 available skills'));
  console.log(row('templates',       '',                    'Manage project document templates'));

  // ── PROVIDERS ─────────────────────────────────────────────
  printSection('AI PROVIDERS');
  const provs: [string, string][] = [
    ['gemini',   'Google Gemini 2.5 Flash (default)'],
    ['anthropic','Anthropic Claude (prefix-cache support)'],
    ['glm',      'Zhipu AI GLM-5.1'],
    ['kimi',     'Moonshot Kimi-K2'],
    ['deepseek', 'DeepSeek V3'],
    ['groq',     'Groq — Llama 3.3 70B'],
    ['openai',   'OpenAI GPT-4o'],
    ['qwen',     'Alibaba Qwen-3'],
    ['together', 'Together AI — Llama 3.1 70B'],
    ['ollama',   'Ollama — local models (no key needed)'],
  ];
  for (const [prov, desc] of provs) {
    console.log(`  ${C.accent(prov.padEnd(12))} ${C.dim(desc)}`);
  }
  console.log(C.muted('\n  Each role (planner / executor / qa / embedding) can use a different provider.'));
  console.log(C.muted('  Custom providers: set CEOBE_PLANNER_BASE_URL + CEOBE_PLANNER_API_KEY'));

  // ── TELEGRAM ──────────────────────────────────────────────
  printSection('TELEGRAM DAEMON  (ceobe daemon --telegram)');
  const tgCmds: [string, string][] = [
    ['/start',                   'Wake bot & check status'],
    ['/projects',                'List registered workspaces'],
    ['/addproject <n> <path>',   'Register a new workspace'],
    ['/cd <name>',               'Switch active workspace'],
    ['/mode <ask|autonomous>',   'Toggle HITL / full-auto'],
    ['/auto',                    'Shortcut — set mode to autonomous'],
    ['/ask',                     'Shortcut — set mode to ask'],
    ['/status',                  'Pipeline status + queue'],
    ['/cost',                    'Live token usage & cost'],
    ['/logs',                    'Tail last 50 execution lines'],
    ['/read <file>',             'Read a project file remotely'],
    ['/index',                   'Build semantic memory index (RAG)'],
    ['/doctor',                  'Run system diagnostics'],
    ['/reflect',                 'AI self-reflection on logs'],
    ['/reset',                   'Reset pipeline state'],
    ['/worktree',                'Toggle worktree isolation mode'],
    ['/cancel',                  'Clear task queue'],
    ['/clear',                   'Clear message context'],
    ['/help',                    'Show command list'],
    ['<any message>',            'Treated as a task instruction'],
  ];
  for (const [cmd, desc] of tgCmds) {
    console.log(`  ${C.accent(cmd.padEnd(26))} ${C.dim(desc)}`);
  }

  // ── PENTEST (gated behind eunectes unlock) ────────────────
  if (process.env.CEOBE_UNLOCK_PENTEST === 'true') {
    printSection('PENTEST  (ceobe pentest <target> --mode <mode>)');
    const modes: [string, string][] = [
      ['auto',               'Auto-detect based on target'],
      ['bug-bounty',         'HackerOne / Bugcrowd — scope-strict'],
      ['red-team',           'Stealth ops, persistence, lateral movement'],
      ['ctf',                'HackTheBox / TryHackMe — speed-first'],
      ['blue-team',          'Detection, IR, defensive audit'],
      ['offensive',          'Aggressive exploitation, PoC chains'],
      ['grey-hat',           'Balanced offensive / defensive'],
      ['forensic',           'Evidence preservation, chain-of-custody'],
      ['reverse-engineering','Binary analysis, decompilation'],
      ['mobile-pentest',     'Android / iOS assessment'],
      ['team',               '3-agent mailbox: recon → exploit → report'],
    ];
    for (const [mode, desc] of modes) {
      console.log(`  ${C.red(mode.padEnd(22))} ${C.dim(desc)}`);
    }
  }

  // ── QUICK START ───────────────────────────────────────────
  printSection('QUICK START');
  const steps = [
    ['ceobe setup',                   'Configure API keys interactively'],
    ['ceobe auto "Build a Go API"',   'Full autonomous build'],
    ['ceobe plan "Landing page"',     'Generate plan for manual review'],
    ['ceobe audit',                   'QA-check the generated plan'],
    ['ceobe execute',                 'Run the approved plan'],
  ];
  steps.forEach(([cmd, desc], i) => {
    console.log(`  ${C.dim((i + 1) + '.')} ${C.accent(cmd.padEnd(34))} ${C.dim(desc)}`);
  });

  console.log('');
  console.log(C.dim(`  ─────────────────────────────────────────────────────`));
  console.log(
    C.muted('  Source: ') + C.dim('https://github.com/Yoraexe/ceobe') +
    C.muted('  ·  License: MIT') +
    C.muted(`  ·  v${VERSION}`)
  );
  console.log('');
}
