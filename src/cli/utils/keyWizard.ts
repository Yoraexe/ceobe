import chalk from 'chalk';
import * as readline from 'readline';
import { 
  readAllKeys, 
  getRequiredKeyForActiveProviders, 
  KEY_DEFINITIONS, 
  KeyDefinition, 
  setKey 
} from '../../utils/keyManager';

export function maskKey(value: string): string {
  if (!value) return chalk.red('(belum diset)');
  if (value.length <= 8) return '****';
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export function printKeyTable(): void {
  const stored = readAllKeys();
  const activeRequiredKeys = getRequiredKeyForActiveProviders();
  
  const rawPlanner = process.env.CEOBE_PLANNER_PROVIDER || '';
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER || '';
  
  const plannerProvider = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;
  const qaProvider = process.env.CEOBE_QA_PROVIDER || plannerProvider;

  console.log(chalk.bold('\n🔑 API Keys Ceobe (disimpan di ~/.ceobe/keys.json)\n'));
  
  const plannerLabel = plannerProvider ? chalk.cyan(plannerProvider.toUpperCase()) : chalk.yellow('(BELUM DISET)');
  const executorLabel = executorProvider ? chalk.cyan(executorProvider.toUpperCase()) : chalk.yellow('(BELUM DISET)');
  const qaLabel = qaProvider ? chalk.cyan(qaProvider.toUpperCase()) : chalk.yellow('(BELUM DISET)');
  
  console.log(chalk.gray(`  Planner: ${plannerLabel}  |  Executor: ${executorLabel}  |  QA: ${qaLabel}\n`));

  const requiredKeys = KEY_DEFINITIONS.filter((k) => activeRequiredKeys.includes(k.envKey));
  const optionalKeys = KEY_DEFINITIONS.filter((k) => !activeRequiredKeys.includes(k.envKey) && !k.envKey.includes('PROVIDER') && !k.envKey.includes('MODEL'));
  const configKeys = KEY_DEFINITIONS.filter((k) => k.envKey.includes('PROVIDER') || k.envKey.includes('MODEL'));

  const printGroup = (title: string, keys: KeyDefinition[], emptyMsg?: string) => {
    console.log(chalk.underline(title));
    if (keys.length === 0 && emptyMsg) {
      console.log(chalk.dim(`  ${emptyMsg}`));
    }
    for (const def of keys) {
      const value = stored[def.envKey] || process.env[def.envKey] || '';
      const source = stored[def.envKey]
        ? chalk.green('ceobe key')
        : process.env[def.envKey]
        ? chalk.gray('.env / system')
        : '';
      const masked = maskKey(value);
      const tag = activeRequiredKeys.includes(def.envKey) && !value ? chalk.bgRed.white(' WAJIB ') : '';
      console.log(
        `  ${chalk.cyan(def.provider.padEnd(20))} ${masked.padEnd(30)} ${source} ${tag}`
      );
    }
    console.log('');
  };

  if (requiredKeys.length > 0) {
    printGroup('DIPERLUKAN (untuk provider aktif Anda)', requiredKeys);
  } else {
    console.log(chalk.yellow('⚠️  DIPERLUKAN (untuk provider aktif Anda)'));
    console.log(chalk.dim('  Pilih provider planner/executor terlebih dahulu agar key yang diperlukan muncul di sini.\n'));
  }

  printGroup('KONFIGURASI PROVIDER (pilih model)', configKeys);
  printGroup('API KEYS LAINNYA (opsional)', optionalKeys);

  console.log(chalk.gray('Untuk mengatur key/provider: ceobe key set <provider> <value>'));
  console.log(chalk.gray('Contoh: ceobe key set planner-provider deepseek\n'));
}

async function prompt(question: string, hidden: boolean = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (hidden) {
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
  const activeRequiredKeys = getRequiredKeyForActiveProviders();
  const required = KEY_DEFINITIONS.filter((k) => activeRequiredKeys.includes(k.envKey));
  const optional = KEY_DEFINITIONS.filter((k) => !activeRequiredKeys.includes(k.envKey));

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
