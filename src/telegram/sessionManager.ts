// Tujuan: Mengelola berkas status sesi aktif (.ceobe/sessions.json) bagi pengguna bot Telegram untuk pelacakan multi-project.
// Caller: src/telegram/telegramDaemon.ts, src/telegram/handlers/*
// Dependensi: fs, path, os, utils/projectRegistry
// Main Functions: getActiveSession, switchSession, sessionStore
// Side Effects: Membaca/menulis berkas sessions.json di home directory target.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readProjects } from '../utils/projectRegistry';
import lockfile from 'proper-lockfile';

import { CeobeMode } from '../utils/modeManager';

export interface ProjectSession {
  projectName: string;
  projectPath: string;
  mode?: CeobeMode;
}

const SESSION_FILE = path.join(os.homedir(), '.ceobe', 'sessions.json');
export const sessionStore = new Map<number, ProjectSession>();

function loadSessions(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      let release: (() => void) | undefined;
      try {
        release = lockfile.lockSync(SESSION_FILE, { retries: { retries: 5, minTimeout: 50, maxTimeout: 500 } });
      } catch (err) {
        console.warn(`[SessionManager] Warning: Failed to acquire lock for reading sessions file: ${(err as Error).message}`);
      }
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        const numKey = Number(key);
        if (!isNaN(numKey)) {
          sessionStore.set(numKey, value as ProjectSession);
        }
      }
      if (release) release();
    }
  } catch {
    // Ignore corrupt session file
  }
}

function saveSessions(): void {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(SESSION_FILE)) {
      fs.writeFileSync(SESSION_FILE, '{}', { encoding: 'utf8', mode: 0o600 });
    }

    let release: (() => void) | undefined;
    try {
      release = lockfile.lockSync(SESSION_FILE, { retries: { retries: 5, minTimeout: 50, maxTimeout: 500 } });
    } catch (err) {
      throw new Error(`[SessionManager] Failed to acquire lock for saving sessions: ${(err as Error).message}`);
    }

    try {
      const data = Object.fromEntries(sessionStore.entries());
      const tempPath = SESSION_FILE + '.tmp.' + crypto.randomUUID();
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, SESSION_FILE);
    } finally {
      if (release) release();
    }
  } catch (err) {
    console.error(`[SessionManager] Error saving sessions: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Load sessions on startup
loadSessions();

export function getActiveSession(chatId: number): ProjectSession | undefined {
  return sessionStore.get(chatId);
}

export function getSessionMode(chatId: number): CeobeMode | undefined {
  return sessionStore.get(chatId)?.mode;
}

export function setSessionMode(chatId: number, mode: CeobeMode): void {
  const session = sessionStore.get(chatId);
  if (session) {
    session.mode = mode;
    saveSessions();
  } else {
    sessionStore.set(chatId, { projectName: 'default', projectPath: process.cwd(), mode });
    saveSessions();
  }
}

export function switchSession(chatId: number, projectName: string): boolean {
  const projects = readProjects();
  const projPath = projects[projectName];
  if (projPath && fs.existsSync(projPath) && fs.statSync(projPath).isDirectory()) {
    const currentSession = sessionStore.get(chatId);
    sessionStore.set(chatId, {
      projectName,
      projectPath: projPath,
      mode: currentSession?.mode,
    });
    saveSessions();
    return true;
  }
  return false;
}
