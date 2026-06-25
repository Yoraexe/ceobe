import { Command } from 'commander';
import { handleReverseEngineer } from '../../../ai/tools/handlers/reverseEngineer';
import chalk from 'chalk';

export function registerReconCommand(program: Command): void {
  program
    .command('recon <url>')
    .description('Perform dynamic reverse engineering on a target URL')
    .option('--depth <level>', 'Set scanning depth (shallow or deep)', 'shallow')
    .option('--focus <areas>', 'Comma-separated focus areas (e.g. tech_stack,api_endpoints)', '')
    .action(async (url: string, options) => {
      console.log(chalk.cyan(`🔍 Starting recon on ${url}...`));
      const focusArr = options.focus ? options.focus.split(',') : [];
      const result = await handleReverseEngineer({ url, depth: options.depth, focus: focusArr });
      console.log('\n' + result);
    });
}
