// Tujuan: Mengelola berkas status sesi aktif (.ceobe/sessions.json) bagi pengguna bot Telegram untuk pelacakan multi-project.
// Caller: src/telegram/telegramDaemon.ts, src/telegram/handlers/*
// Dependensi: fs, path, os, utils/projectRegistry
// Main Functions: getActiveSession, switchSession, sessionStore
// Side Effects: Membaca/menulis berkas sessions.json di home directory target.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readProjects } from '../utils/projectRegistry';

export interface ProjectSession {
  projectName: string;
  projectPath: string;
}

const SESSION_FILE = path.join(os.homedir(), '.ceobe', 'sessions.json');
export const sessionStore = new Map<number, ProjectSession>();

function loadSessions(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        const numKey = Number(key);
        if (!isNaN(numKey)) {
          sessionStore.set(numKey, value as ProjectSession);
        }
      }
    }
  } catch {
    // Ignore corrupt session file
  }
}

function saveSessions(): void {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = Object.fromEntries(sessionStore.entries());
    const tempPath = SESSION_FILE + '.tmp.' + Math.random().toString(36).substring(2);
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, SESSION_FILE);
  } catch {
    // Ignore save errors
  }
}

// Load sessions on startup
loadSessions();

export function getActiveSession(chatId: number): ProjectSession | undefined {
  return sessionStore.get(chatId);
}

export function switchSession(chatId: number, projectName: string): boolean {
  const projects = readProjects();
  if (projectName in projects) {
    sessionStore.set(chatId, {
      projectName,
      projectPath: projects[projectName],
    });
    saveSessions();
    return true;
  }
  return false;
}
