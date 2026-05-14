import chalk from 'chalk';
import { env } from '../config/env';
import { readAllKeys, KEY_DEFINITIONS, getRequiredKeyForActiveProviders } from './keyManager';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold.cyan('\n🩺 Ceobe Diagnostic Tool\n'));

  // 0. Show active provider configuration
  const rawPlanner = process.env.CEOBE_PLANNER_PROVIDER || '';
  const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER || '';
  
  const plannerProvider = rawPlanner || rawExecutor || '(not set)';
  const executorProvider = rawExecutor || rawPlanner || '(not set)';
  
  const plannerModel = process.env.CEOBE_PLANNER_MODEL || '(default model)';
  const executorModel = process.env.CEOBE_EXECUTOR_MODEL || '(default model)';
  const embeddingProvider = process.env.CEOBE_EMBEDDING_PROVIDER || plannerProvider;

  console.log(chalk.bold('0. Active Provider Configuration:'));
  console.log(`  ${chalk.cyan('Planner  ')}  →  ${chalk.white(plannerProvider)} / ${chalk.gray(plannerModel)}`);
  console.log(`  ${chalk.cyan('Executor ')}  →  ${chalk.white(executorProvider)} / ${chalk.gray(executorModel)}`);
  console.log(`  ${chalk.cyan('Embedding')}  →  ${chalk.white(embeddingProvider)}`);
  console.log(chalk.gray(`  (Change with: ${chalk.white('ceobe key set planner-provider <name>')})`));

  // 1. Check API Keys — only for active providers
  console.log(chalk.bold('\n1. API Keys (for active providers):'));
  const storedKeys = readAllKeys();
  const requiredEnvKeys = getRequiredKeyForActiveProviders();
  let keysOk = true;

  for (const envKey of requiredEnvKeys) {
    const def = KEY_DEFINITIONS.find(d => d.envKey === envKey);
    const label = def?.label || envKey;
    const value = storedKeys[envKey] || process.env[envKey];
    if (!value) {
      console.log(chalk.red(`  ✗ ${label} (${envKey}) is MISSING — required for your active provider.`));
      console.log(chalk.yellow(`    Fix: ceobe key set ${def?.provider || envKey.toLowerCase().replace('_api_key', '')} <your-key>`));
      keysOk = false;
    } else {
      console.log(chalk.green(`  ✓ ${label} is configured.`));
    }
  }

  // Show other configured optional keys
  const otherConfigured = KEY_DEFINITIONS.filter(d =>
    !requiredEnvKeys.includes(d.envKey) &&
    (storedKeys[d.envKey] || process.env[d.envKey])
  );
  if (otherConfigured.length > 0) {
    console.log(chalk.gray(`  ○ Additional keys configured: ${otherConfigured.map(d => d.provider).join(', ')}`));
  }

  if (keysOk) {
    console.log(chalk.green('\n  All required keys for your active providers are set. ✅'));
  } else {
    console.log(chalk.yellow('\n  Run `ceobe setup` to configure missing keys.'));
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
