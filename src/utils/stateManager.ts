// Tujuan: Mengelola status fase berjalan (state) Ceobe di dalam file .ceobe-state.json.
// Caller: src/index.ts, src/ai/executor.ts
// Dependensi: fs, path, env
// Main Functions: readState, writeState, markPhaseComplete
// Side Effects: Read/write file system (.ceobe-state.json dan .lock)

import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import chalk from 'chalk';

export interface CeobeState {
  currentPhase: 'plan' | 'design' | 'audit' | 'execute' | 'verify' | 'devops' | 'build-feature' | 'done';
  completedPhases: string[];
  completedFiles: string[];
  lastUpdated: string;
}

let cachedState: CeobeState | null = null;

export function getStateFilePath(): string {
  return path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'ceobe-state.json');
}

export function readState(): CeobeState | null {
  if (cachedState) return cachedState;
  
  const statePath = getStateFilePath();
  if (!fs.existsSync(statePath)) {
    return null;
  }
  
  // Wait if locked (Basic IPC Mutex via lockfile)
  const lockPath = statePath + '.lock';
  let retries = 10;
  while (fs.existsSync(lockPath) && retries > 0) {
    const start = Date.now();
    while (Date.now() - start < 100) {} // Sync sleep 100ms
    retries--;
  }

  try {
    const data = fs.readFileSync(statePath, 'utf8');
    cachedState = JSON.parse(data);
    return cachedState;
  } catch (err) {
    console.error(chalk.yellow('Failed to read .ceobe/ceobe-state.json'));
    return null;
  }
}

export function writeState(state: Partial<CeobeState>): void {
  const statePath = getStateFilePath();
  const lockPath = statePath + '.lock';
  const dir = path.dirname(statePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Basic locking
  let retries = 10;
  while (fs.existsSync(lockPath) && retries > 0) {
    const start = Date.now();
    while (Date.now() - start < 100) {} // Sync sleep 100ms
    retries--;
  }
  
  fs.writeFileSync(lockPath, 'locked');

  try {
    let currentState: CeobeState;
    if (fs.existsSync(statePath)) {
       try {
         currentState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
       } catch (err) {
         currentState = { currentPhase: 'plan', completedPhases: [], completedFiles: [], lastUpdated: new Date().toISOString() };
       }
    } else {
       currentState = { currentPhase: 'plan', completedPhases: [], completedFiles: [], lastUpdated: new Date().toISOString() };
    }
    const newState: CeobeState = {
      ...currentState,
      ...state,
      lastUpdated: new Date().toISOString()
    };

    cachedState = newState;
    fs.writeFileSync(statePath, JSON.stringify(newState, null, 2), 'utf8');
  } finally {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
}

export function markPhaseComplete(phaseName: string, nextPhase: CeobeState['currentPhase']): void {
  const currentState = readState();
  const completed = currentState ? new Set(currentState.completedPhases) : new Set<string>();
  completed.add(phaseName);
  
  writeState({
    currentPhase: nextPhase,
    completedPhases: Array.from(completed)
  });
}

export function markFileComplete(filePath: string): void {
  const currentState = readState();
  const files = currentState ? new Set(currentState.completedFiles || []) : new Set<string>();
  
  if (files.has(filePath)) return; // Skip disk write if already complete
  
  files.add(filePath);
  
  writeState({
    completedFiles: Array.from(files)
  });
}

export function getCompletedFiles(): string[] {
  const currentState = readState();
  return currentState?.completedFiles || [];
}
