// Module: src/utils/gitManager.ts
// Tujuan: Menyediakan Git Snapshot & Rollback sebagai safety net sebelum eksekusi AI.
//         Membuat commit otomatis sebelum eksekusi dimulai, dan melakukan hard reset
//         ke snapshot tersebut jika pipeline gagal melampaui batas retry.
// Caller: src/ai/supervisor.ts
// Dependensi: child_process (execAsync), path, chalk
// Main Functions: isGitRepo, createSnapshot, rollbackToSnapshot, getSnapshotHash
// Side Effects: Membuat commit di repository git target. Dapat mengubah HEAD.
// v1.7.0: Modul baru — Fase 2 dari Ceobe Enterprise Upgrade.

import { exec } from 'child_process';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir, log } from './context';

import { promisify } from 'util';

const execAsync = promisify(exec);

const cwd = () => getProjectDir();

const SNAPSHOT_COMMIT_MSG = 'chore(ceobe): auto-snapshot before AI execution [CEOBE_SNAPSHOT]';

/**
 * Checks whether the target project directory is a Git repository.
 */
export async function isGitRepo(dir?: string): Promise<boolean> {
  const targetDir = dir || cwd();
  try {
    await execAsync('git rev-parse --is-inside-work-tree', { cwd: targetDir });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if there are any uncommitted changes to snapshot.
 */
async function hasChanges(dir: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: dir });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Returns a list of changed/untracked files.
 */
export async function getChangedFiles(): Promise<string[]> {
  const dir = cwd();
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: dir });
    const lines = stdout.split('\n').filter(l => l.trim().length > 0);
    // line format: " M path/to/file" or "?? path/to/file"
    const files = lines.map(l => l.substring(3).trim());
    return files;
  } catch {
    return [];
  }
}

/**
 * Creates a Git snapshot commit before AI execution.
 * Returns the commit hash of the snapshot, or null if the repo is clean / not a git repo.
 */
export async function createSnapshot(): Promise<string | null> {
  const dir = cwd();
  const isRepo = await isGitRepo(dir);
  if (!isRepo) {
    log(chalk.yellow('[GitManager] Direktori bukan Git repo. Snapshot dilewati.'));
    return null;
  }

  const dirty = await hasChanges(dir);
  if (!dirty) {
    // No changes to snapshot — return current HEAD as reference
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: dir });
      const hash = stdout.trim();
      log(chalk.dim(`[GitManager] Workspace bersih. HEAD saat ini: ${hash.substring(0, 8)}`));
      return hash;
    } catch {
      return null;
    }
  }

  try {
    await execAsync('git add -A', { cwd: dir });
    await execAsync(`git commit -m "${SNAPSHOT_COMMIT_MSG}" --allow-empty`, { cwd: dir });
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: dir });
    const hash = stdout.trim();
    log(chalk.green(`[GitManager] ✅ Snapshot dibuat → commit ${hash.substring(0, 8)}`));
    return hash;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(chalk.yellow(`[GitManager] Gagal membuat snapshot: ${msg}`));
    return null;
  }
}

/**
 * Rolls back the repository to a specific commit hash using hard reset.
 * WARNING: This will DISCARD all uncommitted and post-snapshot changes.
 * Only call this when the pipeline has definitively failed.
 */
export async function rollbackToSnapshot(snapshotHash: string): Promise<void> {
  const dir = cwd();
  const isRepo = await isGitRepo(dir);
  if (!isRepo) {
    log(chalk.yellow('[GitManager] Bukan Git repo. Rollback tidak bisa dilakukan.'));
    return;
  }

  // Security: Prevent command injection
  if (!/^[0-9a-fA-F]{40}$/.test(snapshotHash)) {
    log(chalk.red(`[GitManager] ❌ Hash snapshot tidak valid: ${snapshotHash}`));
    return;
  }


  try {
    log(chalk.red(`\n[GitManager] 🔄 Memulai rollback ke snapshot ${snapshotHash.substring(0, 8)}...`));
    await execAsync(`git reset --hard ${snapshotHash}`, { cwd: dir });
    log(chalk.green('[GitManager] ✅ Rollback berhasil. Codebase dikembalikan ke kondisi sebelum eksekusi AI.'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(chalk.red(`[GitManager] ❌ Rollback gagal: ${msg}`));
    log(chalk.yellow(`  Untuk rollback manual, jalankan: git reset --hard ${snapshotHash}`));
  }
}

/**
 * Creates an isolated Git worktree for parallel or safe execution.
 * Returns the absolute path of the new worktree.
 */
export async function createWorktree(branchName: string): Promise<string> {
  const dir = cwd();
  const isRepo = await isGitRepo(dir);
  if (!isRepo) throw new Error('Not a git repository. Cannot create worktree.');

  const worktreesDir = path.join(dir, '.ceobe', 'worktrees');
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  const worktreePath = path.join(worktreesDir, branchName);
  try {
    await execAsync(`git worktree add -b ${branchName} "${worktreePath}"`, { cwd: dir });
    log(chalk.green(`[GitManager] ✅ Worktree created at ${worktreePath}`));
    return worktreePath;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create worktree: ${msg}`);
  }
}

/**
 * Removes a git worktree.
 */
export async function removeWorktree(worktreePath: string): Promise<void> {
  const dir = cwd();
  try {
    await execAsync(`git worktree remove -f "${worktreePath}"`, { cwd: dir });
    log(chalk.dim(`[GitManager] Worktree removed: ${worktreePath}`));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(chalk.yellow(`[GitManager] Failed to remove worktree: ${msg}`));
  }
}

/**
 * Merges a worktree branch into the current branch.
 */
export async function mergeWorktree(branchName: string): Promise<void> {
  const dir = cwd();
  try {
    log(chalk.cyan(`[GitManager] Merging branch ${branchName}...`));
    await execAsync(`git merge ${branchName} --no-edit`, { cwd: dir });
    log(chalk.green(`[GitManager] ✅ Merge successful.`));
    await execAsync(`git branch -D ${branchName}`, { cwd: dir });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to merge worktree branch: ${msg}`);
  }
}
