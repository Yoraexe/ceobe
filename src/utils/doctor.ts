import chalk from 'chalk';
import { env, getGatewayUrl } from '../config/env';
import { readAllKeys, KEY_DEFINITIONS } from './keyManager';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold.cyan('\n🩺 Ceobe Diagnostic Tool\n'));

  // 1. Check API Keys
  console.log(chalk.bold('1. API Keys & Connectivity:'));
  const storedKeys = readAllKeys();
  let keysOk = true;

  for (const def of KEY_DEFINITIONS) {
    const value = storedKeys[def.envKey] || process.env[def.envKey];
    if (def.required && !value) {
      console.log(chalk.red(`  ✗ ${def.label} (${def.envKey}) is missing.`));
      keysOk = false;
    } else if (value) {
      console.log(chalk.green(`  ✓ ${def.label} is configured.`));
    }
  }

  // 2. Check Dependencies
  console.log(chalk.bold('\n2. System Dependencies:'));
  const deps = [
    { name: 'Node.js', cmd: 'node -v' },
    { name: 'npm', cmd: 'npm -v' },
    { name: 'Docker', cmd: 'docker -v' },
    { name: 'Git', cmd: 'git --version' },
  ];

  for (const dep of deps) {
    try {
      const { stdout } = await execAsync(dep.cmd);
      console.log(chalk.green(`  ✓ ${dep.name} is available (${stdout.trim()}).`));
    } catch {
      console.log(chalk.yellow(`  ⚠️  ${dep.name} not found or not in PATH.`));
    }
  }

  // 3. Workspace Check
  console.log(chalk.bold('\n3. Workspace Status:'));
  const ceobeDir = path.join(env.TARGET_PROJECT_DIR, '.ceobe');
  if (fs.existsSync(ceobeDir)) {
    console.log(chalk.green(`  ✓ .ceobe/ directory exists.`));
    const logPath = path.join(ceobeDir, 'execution.log');
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      console.log(chalk.green(`  ✓ Execution log found (${(stats.size / 1024).toFixed(1)} KB).`));
    }
  } else {
    console.log(chalk.gray(`  ○ Workspace not yet initialized (no .ceobe/ folder).`));
  }

  // 4. Cloudflare Gateway Check
  console.log(chalk.bold('\n4. AI Gateway:'));
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_GATEWAY_ID) {
    console.log(chalk.green(`  ✓ Cloudflare AI Gateway is configured.`));
  } else {
    console.log(chalk.gray(`  ○ Cloudflare AI Gateway not configured (optional).`));
  }

  console.log(chalk.bold.cyan('\nDiagnostic complete!\n'));
}
