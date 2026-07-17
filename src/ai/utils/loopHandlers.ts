// Tujuan: Menyediakan pembantu alur loop supervisor seperti persetujuan interaktif pengguna, verifikasi multi-bahasa, dan penghentian proses background.
// Caller: src/ai/supervisor.ts
// Dependensi: fs, path, chalk, readline, child_process, utils/context, utils/stateManager
// Main Functions: askUserConfirmation, handleSessionResume, cleanupBackgroundProcesses, runPolyglotVerification
// Side Effects: Tidak ada.

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';
import { promisify } from 'util';
import { exec } from 'child_process';
import { log } from '../../utils/context';
import { readState } from '../../utils/stateManager';
import { activeBackgroundProcesses } from '../tools/systemTools';

const execAsync = promisify(exec);

export async function askUserConfirmation(question: string): Promise<boolean> {
  // Fix M-31: Prevent infinite hang in non-interactive CI/CD environments
  if (process.env.CI || !process.stdin.isTTY) {
    console.log(chalk.yellow(`\n[Auto-Abort] CI/CD environment detected. Automatically rejecting: ${question}`));
    return false;
  }

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

export async function handleSessionResume(isFeature: boolean): Promise<string> {
  let startingPhase = 'plan';
  const currentState = await readState();
  
  if (currentState && currentState.currentPhase !== 'done' && !isFeature) {
    log(chalk.yellow(`\n[Supervisor] Found incomplete run. Phase: ${currentState.currentPhase}`));
    const proceed = await askUserConfirmation('Do you want to resume this run?');
    if (proceed) {
      startingPhase = currentState.currentPhase;
    } else {
      log(chalk.yellow('Starting a fresh run instead...'));
    }
  }
  return startingPhase;
}

export async function cleanupBackgroundProcesses(): Promise<void> {
  if (activeBackgroundProcesses.size > 0) {
    log(chalk.yellow(`\n[Supervisor] Cleaning up ${activeBackgroundProcesses.size} background processes...`));
    for (const [id, child] of activeBackgroundProcesses.entries()) {
      child.kill('SIGKILL');
      activeBackgroundProcesses.delete(id);
    }
  }
}

export async function runPolyglotVerification(projectDir: string): Promise<void> {
  // Prevent running tests recursively if Ceobe is run on itself
  if (path.resolve(projectDir) === path.resolve(__dirname, '../../..')) {
    log(chalk.yellow(`\n[Supervisor] Verification skipped because target project is Ceobe itself.`));
    return;
  }

  // Check TypeScript compilation
  const hasTsconfig = fs.existsSync(path.join(projectDir, 'tsconfig.json'));
  if (hasTsconfig) {
    log(chalk.gray(`Running: npx tsc --noEmit`));
    await execAsync('npx tsc --noEmit', { cwd: projectDir, timeout: 120000 });
  }

  // Check Tests if vitest/jest is available in package.json
  const pkgJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
     const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
     if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
        log(chalk.gray(`Running: npx vitest run --passWithNoTests`));
        await execAsync('npx vitest run --passWithNoTests', { cwd: projectDir, timeout: 120000 });
     }
  }
  
  // Polyglot: Go
  if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
     log(chalk.gray(`Running: go build ./...`));
     await execAsync('go build ./...', { cwd: projectDir, timeout: 120000 });
     log(chalk.gray(`Running: go test ./...`));
     await execAsync('go test ./...', { cwd: projectDir, timeout: 120000 });
  }
  
  // Polyglot: Rust
  if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
     log(chalk.gray(`Running: cargo check`));
     await execAsync('cargo check', { cwd: projectDir, timeout: 120000 });
     log(chalk.gray(`Running: cargo test`));
     await execAsync('cargo test', { cwd: projectDir, timeout: 120000 });
  }
  
  // Polyglot: PHP/Laravel
  if (fs.existsSync(path.join(projectDir, 'composer.json'))) {
     try {
        log(chalk.gray(`Running: composer validate`));
        await execAsync('composer validate --no-check-all', { cwd: projectDir, timeout: 120000 });
     } catch (error: unknown) {
        // Fix H-20: Only ignore if composer is missing, don't swallow validation errors
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes('not recognized') && !msg.includes('not found')) {
           throw error; 
        }
     }
     
     if (fs.existsSync(path.join(projectDir, 'artisan'))) {
        log(chalk.gray(`Running: php artisan about`));
        try {
           await execAsync('php artisan about', { cwd: projectDir, timeout: 120000 });
        } catch (error: unknown) {
           const msg = error instanceof Error ? error.message : String(error);
           if (!msg.includes('not recognized') && !msg.includes('not found')) {
              throw error;
           }
        }
     }
  }
  
  // Polyglot: Python
  if (fs.existsSync(path.join(projectDir, 'requirements.txt')) || fs.existsSync(path.join(projectDir, 'pyproject.toml'))) {
     log(chalk.gray(`Running: python -m compileall .`));
     await execAsync('python -m compileall .', { cwd: projectDir, timeout: 120000 });
     // Attempt pytest if exists, but don't fail if command not found
     try {
        log(chalk.gray(`Running: pytest (if available)`));
        await execAsync('pytest', { cwd: projectDir, timeout: 120000 });
     } catch (pytestErr: unknown) {
        // Only fail if pytest actually ran and tests failed. If command not found, ignore.
        const msg = pytestErr instanceof Error ? pytestErr.message : String(pytestErr);
        if ((pytestErr as { stdout?: string }).stdout && !msg.includes('not recognized') && !msg.includes('not found')) {
           throw pytestErr;
        }
     }
  }
}
