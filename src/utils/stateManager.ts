import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import chalk from 'chalk';

export interface CeobeState {
  currentPhase: 'plan' | 'audit' | 'execute' | 'build-feature' | 'done';
  completedPhases: string[];
  lastUpdated: string;
}

export function getStateFilePath(): string {
  return path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'ceobe-state.json');
}

export function readState(): CeobeState | null {
  const statePath = getStateFilePath();
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(chalk.yellow('Failed to read .ceobe/ceobe-state.json'));
    return null;
  }
}

export function writeState(state: Partial<CeobeState>): void {
  const statePath = getStateFilePath();
  const dir = path.dirname(statePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const currentState = readState() || {
    currentPhase: 'plan',
    completedPhases: [],
    lastUpdated: new Date().toISOString()
  };

  const newState: CeobeState = {
    ...currentState,
    ...state,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync(statePath, JSON.stringify(newState, null, 2), 'utf8');
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
