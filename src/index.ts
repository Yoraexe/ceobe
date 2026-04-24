#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { env } from './config/env';
import { selectRelevantSkills, generateBRD, generateArchitecture, generateImplementationPlan, auditPlan } from './ai/planner';
import { executePlan } from './ai/executor';
import * as fs from 'fs';
import * as path from 'path';
import { markPhaseComplete } from './utils/stateManager';

const program = new Command();

program
  .name('ceobe')
  .description('Ceobe CLI: An AI Engineering orchestrator using Gemini 3.1 Pro and Sonnet 4.6 via Cloudflare AI Gateway.')
  .version('1.1.0');

program
  .command('plan <description>')
  .description('Phase 1: Generate BRD, Architecture, and Task Plan for review.')
  .action(async (description: string) => {
    console.log(chalk.blue(`Planning project with description: ${description}`));
    console.log(chalk.gray(`Workspace: ${env.TARGET_PROJECT_DIR}\n`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

      const selectedSkills = await selectRelevantSkills(description);

      const brd = await generateBRD(description, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'brd.md'), brd);

      const arch = await generateArchitecture(brd, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'architecture.md'), arch);

      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'task.md'), plan);
      
      markPhaseComplete('plan', 'audit');
      
      console.log(chalk.magenta(`\n[Planning Phase Complete] Documents saved to .ceobe/ folder.`));
      console.log(chalk.yellow(`Please review brd.md, architecture.md, and task.md.`));
      console.log(chalk.green(`Once approved, run: npx ceobe execute\n`));
    } catch (err) {
      console.error(chalk.red('\n[Error] Project planning failed.'));
      console.error(err);
    }
  });

program
  .command('execute [taskFile]')
  .description('Phase 2: Execute a generated task plan (default: task.md).')
  .action(async (taskFile: string = 'task.md') => {
    console.log(chalk.blue(`Executing plan from: .ceobe/${taskFile}`));
    
    try {
      const taskPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', taskFile);
      if (!fs.existsSync(taskPath)) {
        console.error(chalk.red(`\n[Error] Task file not found at ${taskPath}`));
        console.error(chalk.yellow(`Did you forget to run 'ceobe plan' first?\n`));
        return;
      }

      const planContent = fs.readFileSync(taskPath, 'utf8');
      console.log(chalk.magenta(`\n[Execution Phase Started. Firing up Sonnet 4.6]\n`));
      await executePlan(planContent);
      
      markPhaseComplete('execute', 'done');
    } catch (err) {
      console.error(chalk.red('\n[Error] Execution failed.'));
      console.error(err);
    }
  });

program
  .command('audit [prefix]')
  .description('Phase 1.5: Audit your edited plans for conflicts before execution. Prefix is empty for new projects, or "feature-" for features.')
  .action(async (prefix: string = '') => {
    console.log(chalk.blue(`Auditing plans in .ceobe/ folder with prefix '${prefix}'...`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      const brdPath = path.join(ceobeDir, prefix ? `${prefix}brd.md` : 'brd.md');
      const archPath = path.join(ceobeDir, prefix ? `${prefix}architecture.md` : 'architecture.md');
      const taskPath = path.join(ceobeDir, prefix ? `${prefix}task.md` : 'task.md');

      if (!fs.existsSync(brdPath) || !fs.existsSync(archPath) || !fs.existsSync(taskPath)) {
        console.error(chalk.red(`\n[Error] Missing plan files in ${ceobeDir}. Expected brd, architecture, and task files.`));
        return;
      }

      const combinedContent = `
--- BRD ---
${fs.readFileSync(brdPath, 'utf8')}
--- ARCHITECTURE ---
${fs.readFileSync(archPath, 'utf8')}
--- TASK PLAN ---
${fs.readFileSync(taskPath, 'utf8')}
      `;

      // Simple heuristic: read the BRD description to guess the skills again
      const briefDescription = fs.readFileSync(brdPath, 'utf8').substring(0, 500);
      const selectedSkills = await selectRelevantSkills(briefDescription);

      const passed = await auditPlan(combinedContent, selectedSkills);
      
      if (passed) {
        markPhaseComplete('audit', 'execute');
        console.log(chalk.green(`\nYou are cleared to run: npx ceobe execute ${prefix ? prefix + 'task.md' : ''}\n`));
      } else {
        console.log(chalk.yellow(`\nPlease fix the above issues in your markdown files, then run 'ceobe audit' again.\n`));
      }
    } catch (err) {
      console.error(chalk.red('\n[Error] Audit failed.'));
      console.error(err);
    }
  });

program
  .command('build-feature <description>')
  .description('Build a new feature following Ceobe engineering rules.')
  .action(async (description: string) => {
    console.log(chalk.blue(`Building feature with description: ${description}`));
    console.log(chalk.gray(`Workspace: ${env.TARGET_PROJECT_DIR}\n`));
    
    try {
      const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
      if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

      const selectedSkills = await selectRelevantSkills(description);

      const brd = await generateBRD(description, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-brd.md'), brd);

      const arch = await generateArchitecture(brd, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-architecture.md'), arch);

      const plan = await generateImplementationPlan(arch, selectedSkills);
      fs.writeFileSync(path.join(ceobeDir, 'feature-task.md'), plan);
      
      markPhaseComplete('build-feature', 'audit');
      
      console.log(chalk.magenta(`\n[Feature Blueprint Complete] Documents saved to .ceobe/ folder.`));
      console.log(chalk.yellow(`Please review feature-brd.md, feature-architecture.md, and feature-task.md.`));
      console.log(chalk.green(`Once approved, run: npx ceobe execute feature-task.md\n`));
    } catch (err) {
      console.error(chalk.red('\n[Error] Feature build failed.'));
      console.error(err);
    }
  });

// Parse the arguments
program.parse(process.argv);

// If no arguments passed, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
