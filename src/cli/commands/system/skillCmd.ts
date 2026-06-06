import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getProjectDir } from '../../../utils/context';
import { printBanner, printSection, info } from '../../../ui/banner';

export function registerSkillCommand(program: Command): void {
  const skill = program.command('skill').description('🧩 Manajemen Skill (Keahlian AI)');

  skill
    .command('list')
    .description('Daftar semua skill yang tersedia')
    .action(() => {
      printBanner();
      printSection('🧩 Skill & Kemampuan Tersedia');
      
      const builtInSkillsPath = path.join(__dirname, '../../../../skills');
      const projectSkillsPath = path.join(getProjectDir(), '.ceobe', 'skills');
      
      let found = false;

      const printSkills = (dir: string, source: string) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        if (files.length > 0) {
          found = true;
          console.log(chalk.bold.blue(`\n  [${source}]`));
          files.forEach(f => {
            console.log(chalk.cyan(`   • ${f.replace('.md', '')}`));
          });
        }
      };

      printSkills(builtInSkillsPath, 'Built-in / Core Skills');
      printSkills(projectSkillsPath, 'Custom Project Skills');

      if (!found) {
        info('Belum ada skill tambahan yang ditemukan.');
      }
      console.log('');
    });
}
