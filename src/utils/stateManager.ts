// Tujuan: Mengelola status fase berjalan (state) Ceobe di dalam file .ceobe-state.json.
// Caller: src/index.ts, src/ai/executor.ts
// Dependensi: fs, path, env
// Main Functions: readState, writeState, markPhaseComplete, markFileComplete, markSelfHeal
// Side Effects: Read/write file system (.ceobe-state.json dan .lock)
// v1.7.0: Tambahan field selfHealCount untuk melacak siklus self-healing.

import { getProjectDir, log } from './context';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import lockfile from 'proper-lockfile';

export interface CeobeState {
  currentPhase: 'plan' | 'design' | 'audit' | 'execute' | 'verify' | 'devops' | 'build-feature' | 'done';
  completedPhases: string[];
  completedFiles: string[];
  lastUpdated: string;
  /** Total self-healing cycles consumed in the current/last execution run. */
  selfHealCount?: number;
  /** The last git snapshot created before execution. Used for manual rollbacks. */
  lastSnapshotHash?: string;
}

let cachedState: CeobeState | null = null;

export function getStateFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'ceobe-state.json');
}

export function clearStateCache(): void {
  cachedState = null;
}

export async function readState(): Promise<CeobeState | null> {
  if (cachedState) return cachedState;
  
  try {
    const data = await fs.promises.readFile(getStateFilePath(), 'utf8');
    cachedState = JSON.parse(data);
    return cachedState;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      log(chalk.yellow(`Failed to read .ceobe/ceobe-state.json: ${err.message}`));
    }
    return null;
  }
}

export async function writeState(state: Partial<CeobeState>): Promise<void> {
  const statePath = getStateFilePath();
  const dir = path.dirname(statePath);
  
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (err) {
    // Ignore if directory exists
  }

  // Touch the file if it doesn't exist so proper-lockfile has something to lock (atomic wx flag)
  try {
    await fs.promises.writeFile(statePath, JSON.stringify({ currentPhase: 'plan', completedPhases: [], completedFiles: [], lastUpdated: new Date().toISOString() }), { flag: 'wx', encoding: 'utf8' });
  } catch (err) {
    // Ignore if file already exists (EEXIST)
  }

  // Acquire proper file lock with exponential backoff retries, preventing CPU spin locking
  let release: () => Promise<void>;
  try {
    release = await lockfile.lock(statePath, { 
      retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
      stale: 10000 // Lock auto-expires if process crashes
    });
  } catch (err) {
    log(chalk.yellow(`Could not acquire state lock, proceeding anyway: ${(err as Error).message}`));
    release = async () => {};
  }

  try {
    let currentState: CeobeState;
    try {
      // ALWAYS read fresh from disk inside the lock to prevent race conditions
      currentState = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
    } catch (err) {
      currentState = { currentPhase: 'plan', completedPhases: [], completedFiles: [], lastUpdated: new Date().toISOString() };
    }
    
    const newState: CeobeState = {
      ...currentState,
      ...state,
      lastUpdated: new Date().toISOString()
    };
    
    // Atomic write via temp file
    const tempPath = statePath + '.tmp.' + Math.random().toString(36).substring(2);
    await fs.promises.writeFile(tempPath, JSON.stringify(newState, null, 2), 'utf8');
    await fs.promises.rename(tempPath, statePath);

    cachedState = newState;
  } finally {
    await release();
  }
}

export async function markPhaseComplete(phaseName: string, nextPhase: CeobeState['currentPhase']): Promise<void> {
  clearStateCache();
  const currentState = await readState();
  const completed = currentState ? new Set(currentState.completedPhases) : new Set<string>();
  completed.add(phaseName);
  
  await writeState({
    currentPhase: nextPhase,
    completedPhases: Array.from(completed)
  });
}

const fileLock = new Map<string, Promise<void>>();
export async function markFileComplete(filePath: string): Promise<void> {
  const normPath = 'global_file_lock';
  const prev = fileLock.get(normPath) ?? Promise.resolve();
  let release = () => {};
  const next = new Promise<void>((resolve) => { release = resolve; });
  fileLock.set(normPath, next);
  await prev;

  try {
    clearStateCache();
    const currentState = await readState();
    const files = currentState ? new Set(currentState.completedFiles || []) : new Set<string>();
    
    if (files.has(filePath)) return; // Skip disk write if already complete
    
    files.add(filePath);
    
    await writeState({
      completedFiles: Array.from(files)
    });
  } finally {
    if (fileLock.get(normPath) === next) fileLock.delete(normPath);
    release();
  }
}

export async function getCompletedFiles(): Promise<string[]> {
  const currentState = await readState();
  return currentState?.completedFiles || [];
}

/**
 * Increments the self-healing counter in persistent state.
 * Called by executor.ts on every autonomous bug-fix cycle.
 */
export async function markSelfHeal(): Promise<number> {
  const currentState = await readState();
  const newCount = (currentState?.selfHealCount ?? 0) + 1;
  await writeState({ selfHealCount: newCount });
  return newCount;
}

export async function saveSnapshotHash(hash: string): Promise<void> {
  await writeState({ lastSnapshotHash: hash });
}
