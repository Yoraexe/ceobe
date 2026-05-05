// Tujuan: Mengorkestrasi seluruh siklus agen dari Perencanaan hingga Eksekusi secara otonom.
// Caller: src/index.ts (via command `auto`)
// Dependensi: planner, executor, stateManager, fs, readline (untuk human-in-the-loop)
// Main Functions: runAutonomousLoop
// Side Effects: Read/write .ceobe/ files, invoke API, execute commands, prompt user.

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';
import { env } from '../config/env';
import { selectRelevantSkills, generateBRD, generateDesignSpec, generateArchitecture, generateImplementationPlan, generateDevOpsConfig, auditPlan } from './planner';
import { executePlan } from './executor';
import { markPhaseComplete, readState, getCompletedFiles } from '../utils/stateManager';
import { indexWorkspace } from './memory/indexer';
import { activeBackgroundProcesses } from './tools/systemTools';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { NormalizedContentBlock } from './providers/types';

const execAsync = promisify(exec);

const MAX_RETRIES = 3;

function askUserConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(chalk.yellow(question + ' [y/N]: '), answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function runAutonomousLoop(description: string | NormalizedContentBlock[], askBeforeExecute: boolean = false, isFeature: boolean = false): Promise<void> {
  console.log(chalk.magenta.bold(`\n🚀 [Supervisor Agent] Initiating Autonomous Workflow\n`));
  
  const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
  if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

  const prefix = isFeature ? 'feature-' : '';
  const brdPath = path.join(ceobeDir, `${prefix}brd.md`);
  const designPath = path.join(ceobeDir, `${prefix}design.md`);
  const archPath = path.join(ceobeDir, `${prefix}architecture.md`);
  const taskPath = path.join(ceobeDir, `${prefix}task.md`);
  const devopsPath = path.join(ceobeDir, `${prefix}devops.md`);

  try {
    const currentState = readState();
    let startingPhase = 'plan';
    
    if (currentState && currentState.currentPhase !== 'done' && !isFeature) {
      console.log(chalk.yellow(`\n[Supervisor] Found incomplete run. Phase: ${currentState.currentPhase}`));
      const proceed = await askUserConfirmation('Do you want to resume this run?');
      if (proceed) {
        startingPhase = currentState.currentPhase;
      } else {
        console.log(chalk.yellow('Starting a fresh run instead...'));
        // We could delete state, but proceeding with 'plan' will overwrite it.
      }
    }

    const selectedSkills = await selectRelevantSkills(description);
    
    let isAuditPassed = false;
    let retryCount = 0;
    let feedback: string | undefined = undefined;

    let brd = '';
    let design = '';
    let arch = '';
    let task = '';
    let devops = '';

    // Load existing files if resuming
    if (startingPhase !== 'plan') {
      if (fs.existsSync(brdPath)) brd = fs.readFileSync(brdPath, 'utf8');
      if (fs.existsSync(designPath)) design = fs.readFileSync(designPath, 'utf8');
      if (fs.existsSync(archPath)) arch = fs.readFileSync(archPath, 'utf8');
      if (fs.existsSync(taskPath)) task = fs.readFileSync(taskPath, 'utf8');
      if (fs.existsSync(devopsPath)) devops = fs.readFileSync(devopsPath, 'utf8');
    }

    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit') {
      while (!isAuditPassed && retryCount <= MAX_RETRIES) {
        if (retryCount > 0) {
          console.log(chalk.yellow(`\n[Supervisor] Auto-Correction Cycle ${retryCount}/${MAX_RETRIES}...`));
        }

        // Step 1: Generate Plans
        brd = await generateBRD(description, selectedSkills, feedback);
        fs.writeFileSync(brdPath, brd);
        markPhaseComplete(isFeature ? 'build-feature' : 'plan', 'design');

        design = await generateDesignSpec(brd, selectedSkills, feedback);
        fs.writeFileSync(designPath, design);
        markPhaseComplete('design', 'audit');

        arch = await generateArchitecture(brd, design, selectedSkills, feedback);
        fs.writeFileSync(archPath, arch);

        // Generate DevOps Config BEFORE execution so Claude can build the infrastructure
        devops = await generateDevOpsConfig(arch, '', selectedSkills, feedback);
        fs.writeFileSync(devopsPath, devops);

        task = await generateImplementationPlan(arch, selectedSkills, feedback);
        fs.writeFileSync(taskPath, task);

        // Step 2: Audit
        console.log(chalk.blue(`\n[Supervisor] Submitting plans to Quality Assurance Auditor...`));
        const combinedContent = `\n--- BRD ---\n${brd}\n--- DESIGN ---\n${design}\n--- ARCHITECTURE ---\n${arch}\n--- DEVOPS ---\n${devops}\n--- TASK PLAN ---\n${task}\n`;
        
        const auditResult = await auditPlan(combinedContent, selectedSkills);
        
        if (auditResult.passed) {
          isAuditPassed = true;
          markPhaseComplete('audit', 'execute');
        } else {
          feedback = auditResult.feedback;
          retryCount++;
        }
      }

      if (!isAuditPassed) {
        console.error(chalk.red(`\n[Supervisor Error] Maximum auto-correction retries (${MAX_RETRIES}) reached. Audit still failing.`));
        console.log(chalk.yellow('Supervisor is handing back control to you. Please manually fix the plans in .ceobe/ and run `ceobe audit`.'));
        return;
      }

      console.log(chalk.green(`\n✅ [Supervisor] Audit Passed! Architecture & Design are sound.`));

      // Step 3: Human-in-the-Loop Gate
      if (askBeforeExecute) {
        const proceed = await askUserConfirmation(`\nThe plans have been finalized and approved. Ready to modify your workspace. Proceed?`);
        if (!proceed) {
          console.log(chalk.yellow(`\n[Supervisor] Execution aborted by user. The plans remain in .ceobe/. Run 'ceobe execute' when ready.\n`));
          return;
        }
      }
    }

    // Auto-index before execution
    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit' || startingPhase === 'execute') {
       console.log(chalk.blue(`\n[Supervisor] Indexing workspace for RAG semantic memory...`));
       try {
          await indexWorkspace();
       } catch (err) {
          console.log(chalk.yellow(`[Warning] Indexing failed or skipped. Semantic search may be degraded.`));
       }
    }

    // Step 4: Execute & Verify Loop
    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit' || startingPhase === 'execute' || startingPhase === 'verify') {
      let isCodeValid = false;
      let executionRetry = 0;
      let execFeedback = '';

      while (!isCodeValid && executionRetry <= MAX_RETRIES) {
        if (executionRetry > 0) {
          console.log(chalk.yellow(`\n[Supervisor] Code Correction Cycle ${executionRetry}/${MAX_RETRIES}...`));
        }

        console.log(chalk.magenta(`\n[Supervisor] Transitioning to Execution Engine...\n`));
        
        // Append DevOps specs to the task plan so Claude implements them
        let finalTask = `${task}\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\n${devops}`;
        
        // Inject completed files context if resuming
        const completedFiles = getCompletedFiles();
        if (completedFiles.length > 0) {
           finalTask += `\n\n[ALREADY COMPLETED FILES]\nThe following files were ALREADY created in a previous run. DO NOT recreate them unless you need to fix an error. Just skip to the uncompleted items:\n${completedFiles.map(f => `- ${f}`).join('\n')}`;
        }
        
        if (execFeedback) {
           finalTask += `\n\n[URGENT: FIX THESE ERRORS FROM PREVIOUS RUN]\n${execFeedback}`;
        }
        
        await executePlan(finalTask, arch, design);
        markPhaseComplete('execute', 'verify');

        console.log(chalk.blue(`\n[Supervisor] Running Post-Execution Verification (Quality Layer)...`));
        
        try {
          // Check TypeScript compilation
          const hasTsconfig = fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'tsconfig.json'));
          if (hasTsconfig) {
            console.log(chalk.gray(`Running: npx tsc --noEmit`));
            await execAsync('npx tsc --noEmit', { cwd: env.TARGET_PROJECT_DIR });
          }

          // Check Tests if vitest/jest is available in package.json
          const pkgJsonPath = path.join(env.TARGET_PROJECT_DIR, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
             const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
             if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
                console.log(chalk.gray(`Running: npx vitest run --passWithNoTests`));
                await execAsync('npx vitest run --passWithNoTests', { cwd: env.TARGET_PROJECT_DIR });
             }
          }
          
          // Polyglot: Go
          if (fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'go.mod'))) {
             console.log(chalk.gray(`Running: go build ./...`));
             await execAsync('go build ./...', { cwd: env.TARGET_PROJECT_DIR });
             console.log(chalk.gray(`Running: go test ./...`));
             await execAsync('go test ./...', { cwd: env.TARGET_PROJECT_DIR });
          }
          
          // Polyglot: Rust
          if (fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'Cargo.toml'))) {
             console.log(chalk.gray(`Running: cargo check`));
             await execAsync('cargo check', { cwd: env.TARGET_PROJECT_DIR });
             console.log(chalk.gray(`Running: cargo test`));
             await execAsync('cargo test', { cwd: env.TARGET_PROJECT_DIR });
          }
          
          // Polyglot: PHP/Laravel
          if (fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'composer.json'))) {
             try {
                console.log(chalk.gray(`Running: composer validate`));
                await execAsync('composer validate --no-check-all', { cwd: env.TARGET_PROJECT_DIR });
             } catch (compErr: any) {
                // Ignore if composer not installed globally
             }
             
             if (fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'artisan'))) {
                console.log(chalk.gray(`Running: php artisan about`));
                try {
                   await execAsync('php artisan about', { cwd: env.TARGET_PROJECT_DIR });
                } catch (artisanErr: any) {
                   if (!artisanErr.message.includes('not recognized') && !artisanErr.message.includes('not found')) {
                      throw artisanErr;
                   }
                }
             }
          }
          
          // Polyglot: Python
          if (fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'requirements.txt')) || fs.existsSync(path.join(env.TARGET_PROJECT_DIR, 'pyproject.toml'))) {
             console.log(chalk.gray(`Running: python -m compileall .`));
             await execAsync('python -m compileall .', { cwd: env.TARGET_PROJECT_DIR });
             // Attempt pytest if exists, but don't fail if command not found
             try {
                console.log(chalk.gray(`Running: pytest (if available)`));
                await execAsync('pytest', { cwd: env.TARGET_PROJECT_DIR });
             } catch (pytestErr: any) {
                // Only fail if pytest actually ran and tests failed. If command not found, ignore.
                if (pytestErr.stdout && !pytestErr.message.includes('not recognized') && !pytestErr.message.includes('not found')) {
                   throw pytestErr;
                }
             }
          }

          isCodeValid = true;
          console.log(chalk.green(`\n✅ [Supervisor] Code Verification Passed! No compilation or test errors.`));
          markPhaseComplete('verify', 'devops');
        } catch (verifyError: any) {
          console.log(chalk.red(`\n❌ [Supervisor] Verification Failed.`));
          execFeedback = `Verification failed with output:\n${verifyError.stdout}\n${verifyError.stderr}`;
          console.log(chalk.yellow(execFeedback));
          executionRetry++;
        }
      }

      if (!isCodeValid) {
        console.error(chalk.red(`\n[Supervisor Error] Maximum code correction retries (${MAX_RETRIES}) reached. Verification still failing.`));
        return;
      }
    }

    // Phase 5 is now merged into execution, but we mark done
    markPhaseComplete('devops', 'done');
    console.log(chalk.green.bold(`\n🎉 [Supervisor Agent] Autonomous Workflow Complete! Mission Accomplished.\n`));

  } catch (err: any) {
    console.error(chalk.red('\n[Supervisor Error] Autonomous loop crashed.'));
    console.error(err);
  } finally {
    // Cleanup any zombie background processes
    if (activeBackgroundProcesses.size > 0) {
       console.log(chalk.yellow(`\n[Supervisor] Cleaning up ${activeBackgroundProcesses.size} background processes...`));
       for (const [id, child] of activeBackgroundProcesses.entries()) {
          child.kill('SIGKILL');
          activeBackgroundProcesses.delete(id);
       }
    }
  }
}
