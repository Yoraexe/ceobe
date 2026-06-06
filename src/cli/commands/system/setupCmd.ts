import { Command } from 'commander';
import { runSetupWizard } from '../../utils/keyWizard';
import { printBanner } from '../../../ui/banner';

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('🔃  Wizard interaktif untuk konfigurasi pertama kali')
    .action(async () => {
      printBanner();
      await runSetupWizard();
    });
}
