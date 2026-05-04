// Module: src/utils/keyManager.ts
// Purpose: Manages API keys globally via ~/.ceobe/keys.json
//          Keys stored here are loaded by env.ts before .env lookup.
//          This allows users to configure Ceobe once via CLI without touching any file manually.
// Caller: src/config/env.ts, src/index.ts
// Dependencies: fs, path, os, readline, chalk
// Side Effects: Read/write ~/.ceobe/keys.json

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────
// Storage location: ~/.ceobe/keys.json (global, cross-project)
// ─────────────────────────────────────────────────────────────

export function getKeysStorePath(): string {
  return path.join(os.homedir(), '.ceobe', 'keys.json');
}

export function readAllKeys(): Record<string, string> {
  const filePath = getKeysStorePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function writeAllKeys(keys: Record<string, string>): void {
  const filePath = getKeysStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function getKey(name: string): string {
  return readAllKeys()[name] || '';
}

export function setKey(name: string, value: string): void {
  const keys = readAllKeys();
  keys[name] = value;
  writeAllKeys(keys);
}

export function removeKey(name: string): boolean {
  const keys = readAllKeys();
  if (!(name in keys)) return false;
  delete keys[name];
  writeAllKeys(keys);
  return true;
}

// ─────────────────────────────────────────────────────────────
// Known provider key metadata
// ─────────────────────────────────────────────────────────────

export interface KeyDefinition {
  envKey: string;        // The actual env var name (e.g. GEMINI_API_KEY)
  provider: string;      // Friendly provider slug (e.g. gemini)
  label: string;         // Human-readable label
  required: boolean;     // Is it required for core Ceobe functions?
  docsUrl: string;       // Where to get the key
}

export const KEY_DEFINITIONS: KeyDefinition[] = [
  {
    envKey: 'GEMINI_API_KEY',
    provider: 'gemini',
    label: 'Google Gemini (Planner AI)',
    required: true,
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    envKey: 'ANTHROPIC_API_KEY',
    provider: 'anthropic',
    label: 'Anthropic Claude (Default Executor)',
    required: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    envKey: 'GLM_API_KEY',
    provider: 'glm',
    label: 'Zhipu AI GLM',
    required: false,
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    envKey: 'KIMI_API_KEY',
    provider: 'kimi',
    label: 'Moonshot AI Kimi',
    required: false,
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    envKey: 'DEEPSEEK_API_KEY',
    provider: 'deepseek',
    label: 'DeepSeek',
    required: false,
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    envKey: 'GROQ_API_KEY',
    provider: 'groq',
    label: 'Groq (Llama, Mixtral)',
    required: false,
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    envKey: 'OPENAI_API_KEY',
    provider: 'openai',
    label: 'OpenAI (GPT-4o)',
    required: false,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    envKey: 'TOGETHER_API_KEY',
    provider: 'together',
    label: 'Together AI',
    required: false,
    docsUrl: 'https://api.together.xyz/settings/api-keys',
  },
  {
    envKey: 'QWEN_API_KEY',
    provider: 'qwen',
    label: 'Alibaba Qwen',
    required: false,
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  {
    envKey: 'CLOUDFLARE_ACCOUNT_ID',
    provider: 'cloudflare-account',
    label: 'Cloudflare Account ID (opsional, untuk AI Gateway)',
    required: false,
    docsUrl: 'https://dash.cloudflare.com',
  },
  {
    envKey: 'CLOUDFLARE_GATEWAY_ID',
    provider: 'cloudflare-gateway',
    label: 'Cloudflare Gateway ID (opsional, untuk AI Gateway)',
    required: false,
    docsUrl: 'https://dash.cloudflare.com',
  },
  // ── Provider Selection (non-secret config stored same way for convenience)
  {
    envKey: 'CEOBE_PLANNER_PROVIDER',
    provider: 'planner-provider',
    label: 'Planner Provider (gemini/glm/kimi/claude/deepseek/groq/openai/ollama)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_PLANNER_MODEL',
    provider: 'planner-model',
    label: 'Planner Model Override (opsional)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EXECUTOR_PROVIDER',
    provider: 'executor-provider',
    label: 'Executor Provider (claude/glm/kimi/deepseek/groq/openai/ollama)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EXECUTOR_MODEL',
    provider: 'executor-model',
    label: 'Executor Model Override (opsional)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EMBEDDING_PROVIDER',
    provider: 'embedding-provider',
    label: 'Embedding Provider (gemini/glm/openai/ollama - opsional)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EMBEDDING_MODEL',
    provider: 'embedding-model',
    label: 'Embedding Model Override (opsional)',
    required: false,
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
];

export function findKeyDef(providerOrEnvKey: string): KeyDefinition | undefined {
  const q = providerOrEnvKey.toLowerCase();
  return KEY_DEFINITIONS.find(
    (k) =>
      k.provider.toLowerCase() === q ||
      k.envKey.toLowerCase() === q ||
      k.envKey.toLowerCase().replace('_api_key', '') === q
  );
}

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────

export function maskKey(value: string): string {
  if (!value) return chalk.red('(belum diset)');
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export function printKeyTable(): void {
  const stored = readAllKeys();
  console.log(chalk.bold('\n🔑 API Keys Ceobe (disimpan di ~/.ceobe/keys.json)\n'));

  const requiredKeys = KEY_DEFINITIONS.filter((k) => k.required);
  const optionalKeys = KEY_DEFINITIONS.filter((k) => !k.required);

  const printGroup = (title: string, keys: KeyDefinition[]) => {
    console.log(chalk.underline(title));
    for (const def of keys) {
      // Priority: stored key > process.env
      const value = stored[def.envKey] || process.env[def.envKey] || '';
      const source = stored[def.envKey]
        ? chalk.green('ceobe key')
        : process.env[def.envKey]
        ? chalk.gray('.env / system')
        : '';
      const masked = maskKey(value);
      const tag = def.required && !value ? chalk.bgRed.white(' WAJIB ') : '';
      console.log(
        `  ${chalk.cyan(def.provider.padEnd(20))} ${masked.padEnd(30)} ${source} ${tag}`
      );
    }
    console.log('');
  };

  printGroup('WAJIB (untuk Planner & Executor default)', requiredKeys);
  printGroup('OPSIONAL (untuk provider alternatif)', optionalKeys);
  console.log(chalk.gray('Untuk mengatur key: ceobe key set <provider> <value>'));
  console.log(chalk.gray('Contoh: ceobe key set gemini AIza...\n'));
}

// ─────────────────────────────────────────────────────────────
// Interactive setup wizard
// ─────────────────────────────────────────────────────────────

async function prompt(question: string, hidden: boolean = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (hidden) {
    // Mask input on terminal while typing
    process.stdout.write(question);
    return new Promise((resolve) => {
      let input = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (char: string) => {
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') { // Ctrl+C
          process.exit();
        } else if (char === '\u007f') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(input.length));
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    });
  }

  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

export async function runSetupWizard(): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 Ceobe Setup Wizard\n'));
  console.log('Masukkan API key Anda. Tekan Enter untuk melewati key yang tidak diperlukan.');
  console.log(chalk.gray('Key akan disimpan secara aman di ~/.ceobe/keys.json (hanya bisa dibaca oleh user Anda)\n'));

  const stored = readAllKeys();
  const required = KEY_DEFINITIONS.filter((k) => k.required);
  const optional = KEY_DEFINITIONS.filter((k) => !k.required);

  const processKeys = async (keys: KeyDefinition[], label: string) => {
    console.log(chalk.underline(`\n${label}`));
    for (const def of keys) {
      const existing = stored[def.envKey] || process.env[def.envKey] || '';
      const hint = existing ? chalk.gray(` [saat ini: ${maskKey(existing)}]`) : '';
      const docsHint = chalk.gray(` → ${def.docsUrl}`);
      const value = await prompt(
        `  ${chalk.cyan(def.label)}${docsHint}${hint}\n  Masukkan key (Enter untuk lewati): `,
        true
      );
      if (value) {
        setKey(def.envKey, value);
        console.log(chalk.green(`  ✅ ${def.envKey} berhasil disimpan.\n`));
      } else {
        console.log(chalk.gray(`  ↳ Dilewati.\n`));
      }
    }
  };

  await processKeys(required, '🔴 KEY WAJIB');
  await processKeys(optional, '🟡 KEY OPSIONAL');

  console.log(chalk.green.bold('\n✅ Setup selesai! Jalankan `ceobe --help` untuk mulai.\n'));
}
