import { Command } from 'commander';
import chalk from 'chalk';
import { startTelegramDaemon } from '../../../telegram/telegramDaemon';
import { printBanner } from '../../../ui/banner';

export function registerDaemonCommand(program: Command): void {
  program
    .command('daemon')
    .description('🤖  Jalankan Ceobe sebagai Background Service (via Telegram Bot)')
    .action(async () => {
      printBanner();
      console.log(chalk.bold.cyan('🤖 [Ceobe Telegram Daemon] Starting...'));
      try {
        await startTelegramDaemon();
      } catch (error: unknown) {
        console.error(chalk.red('\n[Daemon Error] Failed to start Telegram daemon.'));
        console.error(String(error));
        process.exit(1);
      }
    });
}
