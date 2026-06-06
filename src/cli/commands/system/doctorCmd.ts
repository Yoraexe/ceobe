import { Command } from 'commander';
import { runDoctor } from '../../../utils/doctor';
import { printBanner } from '../../../ui/banner';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('🩺  Diagnosa API key, provider, dan status workspace')
    .action(async () => {
      printBanner();
      await runDoctor();
    });
}
