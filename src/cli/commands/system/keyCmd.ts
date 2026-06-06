import { Command } from 'commander';
import chalk from 'chalk';
import { setKey, removeKey, findKeyDef, KEY_DEFINITIONS, readAllKeys } from '../../../utils/keyManager';
import { printKeyTable, maskKey } from '../../utils/keyWizard';
import { printBanner, ok, printError } from '../../../ui/banner';

export function registerKeyCommand(program: Command): void {
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
    telegram-token, telegram-allowed-users

  Contoh:
    ceobe key set gemini AIzaSyB...
    ceobe key set telegram-token 12345:ABCDE
`)
    .action((provider: string, value: string) => {
      const def = findKeyDef(provider);
      if (!def) {
        printError(
          `Provider tidak dikenal: '${provider}'`,
          'Gunakan `ceobe key list` untuk melihat daftar provider yang didukung.',
          'ceobe key list'
        );
        process.exit(1);
      }

      setKey(def.envKey, value);
      console.log('');
      ok(`Berhasil menyimpan kredensial untuk ${chalk.bold.cyan(def.provider)}`);
      console.log(chalk.dim(`  Variable: ${def.envKey}`));
      console.log(chalk.dim(`  Value   : ${maskKey(value)}`));
      console.log('');
    });

  keyCmd
    .command('remove <provider>')
    .alias('rm')
    .description('Hapus API key untuk provider tertentu')
    .action((provider: string) => {
      const def = findKeyDef(provider);
      if (!def) {
        printError(
          `Provider tidak dikenal: '${provider}'`,
          'Gunakan `ceobe key list` untuk melihat daftar provider yang didukung.',
          'ceobe key list'
        );
        process.exit(1);
      }

      const isRemoved = removeKey(def.envKey);
      console.log('');
      if (isRemoved) {
        ok(`Berhasil menghapus API key untuk ${chalk.bold.cyan(def.provider)}`);
      } else {
        console.log(chalk.yellow(`  ℹ API key untuk ${def.provider} tidak ditemukan di keys.json`));
      }
      console.log('');
    });

  keyCmd
    .command('get <provider>')
    .description('Tampilkan API key untuk provider tertentu')
    .action((provider: string) => {
      const def = findKeyDef(provider);
      if (!def) {
        printError(
          `Provider tidak dikenal: '${provider}'`,
          'Gunakan `ceobe key list` untuk melihat daftar provider yang didukung.',
          'ceobe key list'
        );
        process.exit(1);
      }

      const keys = readAllKeys();
      const val = keys[def.envKey] || process.env[def.envKey];
      
      console.log('');
      if (val) {
        console.log(chalk.cyan(`  Provider : ${def.provider}`));
        console.log(chalk.cyan(`  Variable : ${def.envKey}`));
        console.log(chalk.cyan(`  Value    : ${maskKey(val)}`));
      } else {
        console.log(chalk.yellow(`  ℹ API key untuk ${def.provider} belum dikonfigurasi.`));
      }
      console.log('');
    });

  keyCmd
    .command('clear')
    .description('Hapus SEMUA API key (Awas!)')
    .action(() => {
      let count = 0;
      const keys = readAllKeys();
      for (const def of KEY_DEFINITIONS) {
        if (keys[def.envKey]) {
          removeKey(def.envKey);
          count++;
        }
      }
      console.log('');
      ok(`Berhasil menghapus ${count} konfigurasi kredensial.`);
      console.log('');
    });
}
