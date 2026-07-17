// Tujuan: Mengelola status fase berjalan (state) Ceobe di dalam file .ceobe-state.json.
// Caller: src/index.ts, src/ai/executor.ts
// Dependensi: fs, path, env
// Main Functions: readState, writeState, markPhaseComplete, markFileComplete, markSelfHeal
// Side Effects: Read/write file system (.ceobe-state.json dan .lock)
// v1.7.0: Tambahan field selfHealCount untuk melacak siklus self-healing.

import { getProjectDir, log, executionContext } from './context';
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
  /** If true, the ponytail lazy ladder rules are disabled. */
  isCreativeMode?: boolean;
  /** Pentest session state — populated when running `ceobe pentest` or `ceobe fullscan`. */
  pentest?: {
    target: string;
    mode: string;
    phase: 'scope' | 'plan' | 'audit' | 'execute' | 'report' | 'done';
    outputDir: string;
    scopePath: string;
    planPath: string;
    reportPath: string;
    startedAt: string;
    completedAt?: string;
  };
}

let globalCachedState: CeobeState | null = null;

function getStateFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'ceobe-state.json');
}

export function clearStateCache(): void {
  const ctx = executionContext.getStore();
  if (ctx) {
    ctx.stateCache = undefined;
  } else {
    globalCachedState = null;
  }
}

export async function readState(): Promise<CeobeState | null> {
  const ctx = executionContext.getStore();
  const cached = ctx ? ctx.stateCache : globalCachedState;
  if (cached) return cached;
  
  const statePath = getStateFilePath();
  if (!fs.existsSync(statePath)) {
    return null;
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(statePath, { 
      retries: { retries: 5, minTimeout: 50, maxTimeout: 500 },
      stale: 10000 
    });
  } catch (err) {
    throw new Error(`[StateManager] Failed to acquire lock for state file. Aborting to prevent race condition. ${String(err)}`); // Fix M-05
  }

  try {
    const data = await fs.promises.readFile(statePath, 'utf8');
    const parsed = JSON.parse(data);
    if (ctx) ctx.stateCache = parsed;
    else globalCachedState = parsed;
    return parsed;
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      log(chalk.yellow(`Failed to read .ceobe/ceobe-state.json: ${err.message}`));
    }
    return null;
  } finally {
    if (release) await release();
  }
}

export async function writeState(state: Partial<CeobeState> | ((currentState: CeobeState) => Partial<CeobeState>)): Promise<void> {
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
    
    const partialState = typeof state === 'function' ? state(currentState) : state;
    
    const newState: CeobeState = {
      ...currentState,
      ...partialState,
      lastUpdated: new Date().toISOString()
    };
    
    // Atomic write via temp file
    const tempPath = statePath + '.tmp.' + Math.random().toString(36).substring(2);
    await fs.promises.writeFile(tempPath, JSON.stringify(newState, null, 2), 'utf8');
    await fs.promises.rename(tempPath, statePath);

    const ctx = executionContext.getStore();
    if (ctx) ctx.stateCache = newState;
    else globalCachedState = newState;
  } finally {
    await release();
  }
}

export async function markPhaseComplete(phaseName: string, nextPhase: CeobeState['currentPhase']): Promise<void> {
  clearStateCache();
  await writeState((currentState) => {
    const completed = new Set(currentState.completedPhases);
    completed.add(phaseName);
    return {
      currentPhase: nextPhase,
      completedPhases: Array.from(completed)
    };
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
    await writeState((currentState) => {
      const files = new Set(currentState.completedFiles || []);
      files.add(filePath);
      return { completedFiles: Array.from(files) };
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
  let newCount = 0;
  await writeState((currentState) => {
    newCount = (currentState.selfHealCount ?? 0) + 1;
    return { selfHealCount: newCount };
  });
  return newCount;
}

export async function saveSnapshotHash(hash: string): Promise<void> {
  await writeState({ lastSnapshotHash: hash });
}

/**
 * Save or update pentest session state.
 */
export async function writePentestState(
  pentestState: Partial<NonNullable<CeobeState['pentest']>>
): Promise<void> {
  await writeState((currentState) => ({
    pentest: {
      ...(currentState.pentest ?? {
        target: '',
        mode: 'auto',
        phase: 'scope',
        outputDir: '',
        scopePath: '',
        planPath: '',
        reportPath: '',
        startedAt: new Date().toISOString(),
      }),
      ...pentestState,
    },
  }));
}

/**
 * Read pentest session state.
 */
export async function readPentestState(): Promise<CeobeState['pentest'] | null> {
  const state = await readState();
  return state?.pentest ?? null;
}
