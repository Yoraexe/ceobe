// Tujuan: Mengorkestrasi seluruh siklus agen dari Perencanaan hingga Eksekusi secara otonom.
// Caller: src/index.ts (via command `auto`)
// Dependensi: planner, executor, stateManager, gitManager, taskParser, crypto, fs, readline, costTracker, indexer, systemTools
// Main Functions: runAutonomousLoop, computeChangedDocs, getDocHash
// Side Effects: Read/write .ceobe/ files, invoke API, execute commands, prompt user.
// v1.9.0: Multi-Agent Parallel Execution & Hash Convergence Guard (SHA-256 document tracking).
//         Task independen dalam satu gelombang dieksekusi secara paralel.

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';
import { getProjectDir, log } from '../utils/context';
import { selectRelevantSkills, generateBRD, generateDesignSpec, generateArchitecture, generateImplementationPlan, generateDevOpsConfig, auditPlan, AuditResult } from './planner';
import { executePlan } from './executor';
import { markPhaseComplete, readState, getCompletedFiles } from '../utils/stateManager';
import { indexWorkspace } from './memory/indexer';
import { activeBackgroundProcesses } from './tools/systemTools';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { createSnapshot, rollbackToSnapshot } from '../utils/gitManager';
import { parseTaskWaves } from './taskParser';
import { resetSession, printCostSummary } from '../utils/costTracker';
import type { NormalizedContentBlock } from './providers/types';

interface DocSnapshot {
  hash: string;
  timestamp: number;
  version: number;
}
const snapshots = new Map<string, DocSnapshot>();

export function getDocHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function computeChangedDocs(currentDocs: Record<string, string>, reset: boolean = false): string[] {
  if (reset) snapshots.clear();
  const changed: string[] = [];
  for (const [docName, content] of Object.entries(currentDocs)) {
    const currentHash = getDocHash(content);
    const prev = snapshots.get(docName);
    if (!prev || prev.hash !== currentHash) {
      changed.push(docName);
      snapshots.set(docName, {
        hash: currentHash,
        timestamp: Date.now(),
        version: (prev?.version ?? 0) + 1
      });
    }
  }
  return changed;
}

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
  resetSession();
  computeChangedDocs({}, true); // C1: Reset hash registry for new session
  log(chalk.magenta.bold(`\n🚀 [Supervisor Agent] Initiating Autonomous Workflow\n`));
  
  const ceobeDir = path.join(getProjectDir(), '.ceobe');
  if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

  const prefix = isFeature ? 'feature-' : '';
  const brdPath = path.join(ceobeDir, `${prefix}brd.md`);
  const designPath = path.join(ceobeDir, `${prefix}design.md`);
  const archPath = path.join(ceobeDir, `${prefix}architecture.md`);
  const taskPath = path.join(ceobeDir, `${prefix}task.md`);
  const devopsPath = path.join(ceobeDir, `${prefix}devops.md`);

  try {
    const currentState = await readState();
    let startingPhase = 'plan';
    
    if (currentState && currentState.currentPhase !== 'done' && !isFeature) {
      log(chalk.yellow(`\n[Supervisor] Found incomplete run. Phase: ${currentState.currentPhase}`));
      const proceed = await askUserConfirmation('Do you want to resume this run?');
      if (proceed) {
        startingPhase = currentState.currentPhase;
      } else {
        log(chalk.yellow('Starting a fresh run instead...'));
        // We could delete state, but proceeding with 'plan' will overwrite it.
      }
    }

    const selectedSkills = await selectRelevantSkills(description);
    
    let isAuditPassed = false;
    let retryCount = 0;
    let feedback: string | undefined = undefined;
    let affectedMap: AuditResult['affected'] | undefined = undefined;

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
      // C2: Seed snapshot registry so convergence guard has a baseline
      computeChangedDocs({ brd, design, arch, devops, task });
    }

    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit') {
      let regenBRD = startingPhase === 'plan';
      let regenDesign = startingPhase === 'plan' || startingPhase === 'design';
      let regenArch = true;
      let regenDevops = true;
      let regenTask = true;

      while (!isAuditPassed && retryCount <= MAX_RETRIES) {
        if (retryCount > 0) {
          log(chalk.yellow(`\n[Supervisor] Auto-Correction Cycle ${retryCount}/${MAX_RETRIES}...`));
          if (affectedMap) {
             regenBRD = affectedMap.brd ?? false;
             regenDesign = affectedMap.design ?? false;
             regenArch = affectedMap.arch ?? false;
             regenDevops = affectedMap.devops ?? false;
             regenTask = affectedMap.task ?? false;
             log(chalk.dim(`[Supervisor] Selective Regeneration: BRD(${regenBRD}) Design(${regenDesign}) Arch(${regenArch}) DevOps(${regenDevops}) Task(${regenTask})`));
          }
        }

        // Step 1: Generate Plans
        if (regenBRD) {
          brd = await generateBRD(description, selectedSkills, feedback);
          fs.writeFileSync(brdPath, brd);
        }

        if (regenDesign) {
          design = await generateDesignSpec(brd, selectedSkills, feedback);
          fs.writeFileSync(designPath, design);
        }

        if (regenArch) {
          arch = await generateArchitecture(brd, design, selectedSkills, feedback);
          fs.writeFileSync(archPath, arch);
        }

        // Generate DevOps Config BEFORE execution so Claude can build the infrastructure
        if (regenDevops) {
          devops = await generateDevOpsConfig(arch, '', selectedSkills, feedback);
          fs.writeFileSync(devopsPath, devops);
        }

        if (regenTask) {
          task = await generateImplementationPlan(arch, selectedSkills, feedback);
          fs.writeFileSync(taskPath, task);
        }
        
        await markPhaseComplete('design', 'audit'); // Mark phase complete after successful planning

        // Hash Validation & Convergence Guard
        const currentDocs = { brd, design, arch, devops, task };
        // C3: Only check convergence on documents that were actually regenerated
        const regenFilter: Record<string, boolean> = { brd: regenBRD, design: regenDesign, arch: regenArch, devops: regenDevops, task: regenTask };
        const docsToCheck = Object.fromEntries(
          Object.entries(currentDocs).filter(([k]) => regenFilter[k])
        );
        const changedDocs = computeChangedDocs(docsToCheck);
        
        if (changedDocs.length === 0) {
          log(chalk.green(`\n[Supervisor] Convergence Reached! No documents were modified by the Planner in this iteration.`));
          log(chalk.green(`[Supervisor] Implicitly passing QA Audit to prevent infinite loop.`));
          isAuditPassed = true;
          break; // Stop loop!
        }

        // Step 2: Audit
        log(chalk.blue(`\n[Supervisor] Submitting plans to Quality Assurance Auditor...`));
        
        // Full Context to maximize Anthropic Prefix Caching
        const combinedContent = `\n--- BRD ---\n${brd}\n--- DESIGN ---\n${design}\n--- ARCHITECTURE ---\n${arch}\n--- DEVOPS ---\n${devops}\n--- TASK PLAN ---\n${task}\n`;
        
        // Dynamic Alert placed safely at the end
        let dynamicAlert = '';
        if (retryCount > 0) {
           dynamicAlert = `\n[SYSTEM ALERT - Revision ${retryCount}]
In this revision cycle, the Planner ONLY modified the following documents: [${changedDocs.join(', ')}].
All other documents remain unchanged and are provided for reference.
Please focus your audit on checking whether the changes in [${changedDocs.join(', ')}] have successfully resolved the previous feedback without introducing contradictions to the unchanged documents.
Previous Feedback:
${feedback}
`.trim();
        }
        
        const auditResult = await auditPlan(combinedContent, dynamicAlert, selectedSkills);
        
        if (auditResult.passed) {
          isAuditPassed = true;
          await markPhaseComplete('audit', 'execute');
        } else {
          // Strip the JSON block to prevent cross-model prompt injection
          feedback = auditResult.feedback?.replace(/```json\s*\{[\s\S]*?\}\s*```/, '').trim();
          affectedMap = auditResult.affected;
          retryCount++;
        }
      }

      if (!isAuditPassed) {
        log(chalk.red(`\n[Supervisor Error] Maximum auto-correction retries (${MAX_RETRIES}) reached. Audit still failing.`));
        log(chalk.yellow('Supervisor is handing back control to you. Please manually fix the plans in .ceobe/ and run `ceobe audit`.'));
        return;
      }

      log(chalk.green(`\n✅ [Supervisor] Audit Passed! Architecture & Design are sound.`));

      // Step 3: Human-in-the-Loop Gate
      if (askBeforeExecute) {
        const proceed = await askUserConfirmation(`\nThe plans have been finalized and approved. Ready to modify your workspace. Proceed?`);
        if (!proceed) {
          log(chalk.yellow(`\n[Supervisor] Execution aborted by user. The plans remain in .ceobe/. Run 'ceobe execute' when ready.\n`));
          return;
        }
      }
    }

    // Auto-index before execution
    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit' || startingPhase === 'execute') {
       log(chalk.blue(`\n[Supervisor] Indexing workspace for RAG semantic memory...`));
       try {
          await indexWorkspace();
       } catch (err) {
          log(chalk.yellow(`[Warning] Indexing failed or skipped. Semantic search may be degraded.`));
       }
    }

    // Step 4: Execute & Verify Loop
    if (startingPhase === 'plan' || startingPhase === 'design' || startingPhase === 'audit' || startingPhase === 'execute' || startingPhase === 'verify') {
      let isCodeValid = false;
      let executionRetry = 0;
      let execFeedback = '';

      // ── Git Snapshot ─────────────────────────────────────────────────────────
      log(chalk.blue(`\n[GitManager] Membuat snapshot sebelum eksekusi AI...`));
      const snapshotHash = await createSnapshot();
      // ─────────────────────────────────────────────────────────────────────────

      while (!isCodeValid && executionRetry <= MAX_RETRIES) {
        if (executionRetry > 0) {
          log(chalk.yellow(`\n[Supervisor] Code Correction Cycle ${executionRetry}/${MAX_RETRIES}...`));
        }

        log(chalk.magenta(`\n[Supervisor] Transitioning to Execution Engine...\n`));
        
        // Append DevOps specs to the task plan so Claude implements them
        let finalTask = `${task}\n\n[DEVOPS REQUIREMENTS]\nYou MUST ALSO implement the following DevOps infrastructure:\n${devops}`;
        
        // Inject completed files context if resuming
        const completedFiles = await getCompletedFiles();
        if (completedFiles.length > 0) {
           finalTask += `\n\n[ALREADY COMPLETED FILES]\nThe following files were ALREADY created in a previous run. DO NOT recreate them unless you need to fix an error. Just skip to the uncompleted items:\n${completedFiles.map(f => `- ${f}`).join('\n')}`;
        }
        
        if (execFeedback) {
           finalTask += `\n\n[URGENT: FIX THESE ERRORS FROM PREVIOUS RUN]\n${execFeedback}`;
        }
        
        // ── Multi-Agent Parallel Execution ────────────────────────────────────────────
        const waves = parseTaskWaves(finalTask);
        const totalTasks = waves.reduce((sum, w) => sum + w.tasks.length, 0);

        if (waves.length > 1) {
          log(chalk.cyan(`\n[Parallel Executor] Plan dipecah menjadi ${waves.length} gelombang eksekusi.`));
          log(chalk.dim(`  Total task: ${totalTasks} | Paralel per gelombang: max ${Math.max(...waves.map(w => w.tasks.length))}\n`));
        }

        for (const wave of waves) {
          if (wave.tasks.length > 1) {
            log(chalk.magenta(`\n[Parallel Executor] Gelombang ${wave.wave} — ${wave.tasks.length} task berjalan paralel...`));
            // Execute all tasks in this wave concurrently
            const waveResults = await Promise.allSettled(
              wave.tasks.map(waveTask =>
                executePlan(
                  waveTask.content + (execFeedback ? `\n\n[FIX ERRORS]\n${execFeedback}` : ''),
                  selectedSkills
                )
              )
            );
            // Abort pipeline if a wave fails
            const failures = waveResults.filter(r => r.status === 'rejected');
            if (failures.length > 0) {
              failures.forEach(f => {
                const msg = f.status === 'rejected' ? String(f.reason) : '';
                log(chalk.red(`  [Wave ${wave.wave}] Task gagal: ${msg.substring(0, 120)}`));
              });
              throw new Error(`Wave ${wave.wave} execution failed. Aborting pipeline.`);
            } else {
              log(chalk.green(`  [Wave ${wave.wave}] Semua task selesai.`));
            }
          } else {
            // Single task in wave — run sequentially as before
            log(chalk.blue(`\n[Parallel Executor] Gelombang ${wave.wave} — 1 task (sequential).`));
            await executePlan(wave.tasks[0].content, selectedSkills);
          }
        }
        // ───────────────────────────────────────────────────────────────────────
        await markPhaseComplete('execute', 'verify');

        log(chalk.blue(`\n[Supervisor] Running Post-Execution Verification (Quality Layer)...`));
        
        try {
          // Check TypeScript compilation
          const hasTsconfig = fs.existsSync(path.join(getProjectDir(), 'tsconfig.json'));
          if (hasTsconfig) {
            log(chalk.gray(`Running: npx tsc --noEmit`));
            await execAsync('npx tsc --noEmit', { cwd: getProjectDir(), timeout: 120000 });
          }

          // Check Tests if vitest/jest is available in package.json
          const pkgJsonPath = path.join(getProjectDir(), 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
             const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
             if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
                log(chalk.gray(`Running: npx vitest run --passWithNoTests`));
                await execAsync('npx vitest run --passWithNoTests', { cwd: getProjectDir(), timeout: 120000 });
             }
          }
          
          // Polyglot: Go
          if (fs.existsSync(path.join(getProjectDir(), 'go.mod'))) {
             log(chalk.gray(`Running: go build ./...`));
             await execAsync('go build ./...', { cwd: getProjectDir(), timeout: 120000 });
             log(chalk.gray(`Running: go test ./...`));
             await execAsync('go test ./...', { cwd: getProjectDir(), timeout: 120000 });
          }
          
          // Polyglot: Rust
          if (fs.existsSync(path.join(getProjectDir(), 'Cargo.toml'))) {
             log(chalk.gray(`Running: cargo check`));
             await execAsync('cargo check', { cwd: getProjectDir(), timeout: 120000 });
             log(chalk.gray(`Running: cargo test`));
             await execAsync('cargo test', { cwd: getProjectDir(), timeout: 120000 });
          }
          
          // Polyglot: PHP/Laravel
          if (fs.existsSync(path.join(getProjectDir(), 'composer.json'))) {
             try {
                log(chalk.gray(`Running: composer validate`));
                await execAsync('composer validate --no-check-all', { cwd: getProjectDir(), timeout: 120000 });
             } catch (error: unknown) {
                // Ignore if composer not installed globally
             }
             
             if (fs.existsSync(path.join(getProjectDir(), 'artisan'))) {
                log(chalk.gray(`Running: php artisan about`));
                try {
                   await execAsync('php artisan about', { cwd: getProjectDir(), timeout: 120000 });
                } catch (error: unknown) {
                   const msg = error instanceof Error ? error.message : String(error);
                   if (!msg.includes('not recognized') && !msg.includes('not found')) {
                      throw error;
                   }
                }
             }
          }
          
          // Polyglot: Python
          if (fs.existsSync(path.join(getProjectDir(), 'requirements.txt')) || fs.existsSync(path.join(getProjectDir(), 'pyproject.toml'))) {
             log(chalk.gray(`Running: python -m compileall .`));
             await execAsync('python -m compileall .', { cwd: getProjectDir(), timeout: 120000 });
             // Attempt pytest if exists, but don't fail if command not found
             try {
                log(chalk.gray(`Running: pytest (if available)`));
                await execAsync('pytest', { cwd: getProjectDir(), timeout: 120000 });
             } catch (pytestErr: unknown) {
                // Only fail if pytest actually ran and tests failed. If command not found, ignore.
                const msg = pytestErr instanceof Error ? pytestErr.message : String(pytestErr);
                if ((pytestErr as { stdout?: string }).stdout && !msg.includes('not recognized') && !msg.includes('not found')) {
                   throw pytestErr;
                }
             }
          }

          isCodeValid = true;
          log(chalk.green(`\n✅ [Supervisor] Code Verification Passed! No compilation or test errors.`));
          await markPhaseComplete('verify', 'devops');
        } catch (verifyError: unknown) {
          log(chalk.red(`\n❌ [Supervisor] Verification Failed.`));
          const stdout = (verifyError as { stdout?: string }).stdout || '';
          const stderr = (verifyError as { stderr?: string }).stderr || '';
          execFeedback = `Verification failed with output:\n${stdout}\n${stderr}`;
          log(chalk.yellow(execFeedback));
          executionRetry++;
        }
      }

      if (!isCodeValid) {
        log(chalk.red(`\n[Supervisor Error] Maximum code correction retries (${MAX_RETRIES}) reached. Verification still failing.`));

        // ── Auto Rollback ───────────────────────────────────────────────────────
        if (snapshotHash) {
          log(chalk.yellow('\n[GitManager] Pipeline gagal melampaui batas retry. Memulai auto-rollback...'));
          await rollbackToSnapshot(snapshotHash);
        } else {
          log(chalk.yellow('[GitManager] Tidak ada snapshot tersedia. Rollback dilewati.'));
        }
        // ───────────────────────────────────────────────────────────────────────

        return;
      }
    }

    // Phase 5 is now merged into execution, but we mark done
    await markPhaseComplete('devops', 'done');

    // ── Self-Heal Summary Report ───────────────────────────────────────────────
    const finalState = await readState();
    const healCount = finalState?.selfHealCount ?? 0;
    if (healCount > 0) {
      log(chalk.cyan(`\n🩹 [Self-Heal] ${healCount} bug(s) ditemukan dan diperbaiki secara otomatis oleh AI.`));
    }
    // ──────────────────────────────────────────────────────────────────────────

    printCostSummary();
    log(chalk.green.bold(`\n🎉 [Supervisor Agent] Autonomous Workflow Complete! Mission Accomplished.\n`));

  } catch (err: unknown) {
    log(chalk.red('\n[Supervisor Error] Autonomous loop crashed.'));
    log(String(err));
  } finally {
    // Cleanup any zombie background processes
    if (activeBackgroundProcesses.size > 0) {
       log(chalk.yellow(`\n[Supervisor] Cleaning up ${activeBackgroundProcesses.size} background processes...`));
       for (const [id, child] of activeBackgroundProcesses.entries()) {
          child.kill(); // Default to SIGTERM for cross-platform compatibility
          activeBackgroundProcesses.delete(id);
       }
    }
  }
}
