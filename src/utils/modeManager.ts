import { getProjectDir, executionContext } from './context';
// Module: src/utils/modeManager.ts
// Purpose: Manages Ceobe's active operation mode (autonomous or ask).
//          Mode is persisted in .ceobe/config.json inside the target project.
// Caller: src/index.ts, src/ai/executor.ts
// Dependencies: fs, path, env, readline, chalk
// Side Effects: Read/write .ceobe/config.json
// v1.8.0: Tambahan ConfirmationBridge untuk mendelegasikan prompt ke UI lain (Telegram).

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';


import chalk from 'chalk';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CeobeMode = 'autonomous' | 'ask';

export interface CeobeConfig {
  mode: CeobeMode;
  worktree?: boolean;
  updatedAt: string;
}

/**
 * Interface for delegating human-in-the-loop confirmations to external interfaces (e.g., Telegram).
 */
export interface ConfirmationBridge {
  /**
   * Prompts the user via the external interface.
   * Resolves to true (approve), false (skip), or throws an error (abort pipeline).
   */
  requestConfirmation(summary: string): Promise<boolean>;

  /**
   * Cleans up any resources or listeners when the bridge is no longer needed.
   */
  destroy?(): void;
}

let activeConfirmationBridge: ConfirmationBridge | null = null;

export function setConfirmationBridge(bridge: ConfirmationBridge): void {
  const ctx = executionContext.getStore();
  if (ctx) {
    ctx.confirmationBridge = bridge;
  } else {
    activeConfirmationBridge = bridge;
  }
}

export function clearConfirmationBridge(): void {
  const ctx = executionContext.getStore();
  if (ctx) {
    if (ctx.confirmationBridge?.destroy) {
      ctx.confirmationBridge.destroy();
    }
    ctx.confirmationBridge = undefined;
  } else {
    if (activeConfirmationBridge?.destroy) {
      activeConfirmationBridge.destroy();
    }
    activeConfirmationBridge = null;
  }
}

function getConfirmationBridge(): ConfirmationBridge | null {
  const ctx = executionContext.getStore();
  if (ctx && ctx.confirmationBridge) {
    return ctx.confirmationBridge as ConfirmationBridge;
  }
  return activeConfirmationBridge;
}

/** Tool calls that require confirmation when mode = ask */
export const SENSITIVE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'delete_file',
  'execute_command',
  'rename_file',
  'move_file',
  'start_background_service',
]);

// ─────────────────────────────────────────────
// Config Path
// ─────────────────────────────────────────────

function getConfigPath(): string {
  return path.join(getProjectDir(), '.ceobe', 'config.json');
}

// ─────────────────────────────────────────────
// Read / Write
// ─────────────────────────────────────────────

let globalCachedConfig: CeobeConfig | null = null;

export function clearConfigCacheForTesting(): void {
  const ctx = executionContext.getStore();
  if (ctx) ctx.configCache = undefined;
  else globalCachedConfig = null;
}

export function readConfig(): CeobeConfig {
  const ctx = executionContext.getStore();
  const cached = ctx ? ctx.configCache : globalCachedConfig;
  if (cached) return cached;
  
  const configPath = getConfigPath();
  let loadedConfig: CeobeConfig;
  
  if (!fs.existsSync(configPath)) {
    loadedConfig = { mode: 'autonomous', worktree: false, updatedAt: new Date().toISOString() };
  } else {
    try {
      loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as CeobeConfig;
    } catch {
      loadedConfig = { mode: 'autonomous', worktree: false, updatedAt: new Date().toISOString() };
    }
  }
  
  if (ctx) ctx.configCache = loadedConfig;
  else globalCachedConfig = loadedConfig;
  
  return loadedConfig;
}

export function writeConfig(config: CeobeConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const tmpPath = `${configPath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmpPath, configPath);
  
  const ctx = executionContext.getStore();
  if (ctx) ctx.configCache = config;
  else globalCachedConfig = config;
}

export function getActiveMode(): CeobeMode {
  return readConfig().mode;
}

export function setMode(mode: CeobeMode): void {
  const current = readConfig();
  writeConfig({ ...current, mode, updatedAt: new Date().toISOString() });
}

export function getWorktreeMode(): boolean {
  return readConfig().worktree ?? false;
}

export function setWorktreeMode(worktree: boolean): void {
  const current = readConfig();
  writeConfig({ ...current, worktree, updatedAt: new Date().toISOString() });
}

// ─────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────

export function printModeBadge(): void {
  const mode = getActiveMode();
  if (mode === 'autonomous') {
    console.log(
      chalk.bgGreen.black.bold(` 🤖 MODE: OTONOM `) +
      chalk.green(' Ceobe akan mengeksekusi semua langkah secara mandiri tanpa konfirmasi.\n')
    );
  } else {
    console.log(
      chalk.bgYellow.black.bold(` 🙋 MODE: BERTANYA `) +
      chalk.yellow(' Ceobe akan meminta persetujuan Anda sebelum setiap aksi penting.\n')
    );
  }
}

// ─────────────────────────────────────────────
// Confirmation prompt (used by executor in ask mode)
// ─────────────────────────────────────────────

/**
 * Prompts the user to approve a sensitive tool call.
 * Returns true if approved, false if skipped.
 * Throws if user types 'abort' to stop the entire session.
 */
export async function confirmToolCall(
  toolName: string,
  input: Record<string, unknown>
): Promise<boolean> {
  // Build a human-readable summary of the action
  let summary = '';
  if (toolName === 'write_file' || toolName === 'edit_file') {
    summary = `📝 ${toolName === 'write_file' ? 'Tulis' : 'Edit'} file: ${chalk.cyan(String(input.file_path ?? ''))}`;
  } else if (toolName === 'delete_file') {
    summary = `🗑️  Hapus file: ${chalk.red(String(input.file_path ?? ''))}`;
  } else if (toolName === 'execute_command') {
    summary = `⚡ Jalankan perintah: ${chalk.magenta(String(input.command ?? ''))}`;
  } else if (toolName === 'rename_file') {
    summary = `✏️  Rename: ${chalk.cyan(String(input.old_path ?? ''))} → ${chalk.cyan(String(input.new_path ?? ''))}`;
  } else if (toolName === 'move_file') {
    summary = `📦 Pindah: ${chalk.cyan(String(input.source_path ?? ''))} → ${chalk.cyan(String(input.destination_path ?? ''))}`;
  } else if (toolName === 'start_background_service') {
    summary = `🔌 Start service: ${chalk.magenta(String(input.service_id ?? ''))} (${String(input.command ?? '')})`;
  } else {
    summary = `🔧 ${toolName}: ${JSON.stringify(input).substring(0, 80)}`;
  }

  // Jika ada bridge aktif (misal dari Telegram), delegasikan ke bridge tersebut
  const bridge = getConfirmationBridge();
  if (bridge) {
    return bridge.requestConfirmation(summary);
  }

  // Fallback: gunakan terminal standar (readline)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve, reject) => {
    console.log('\n' + chalk.bgYellow.black(' KONFIRMASI DIPERLUKAN '));
    console.log(summary);
    
    rl.on('SIGINT', () => {
      rl.close();
      reject(new Error('USER_ABORT: Sesi dihentikan oleh pengguna (SIGINT).'));
    });

    rl.question(
      chalk.yellow('\nSetuju? [y] Ya / [n] Lewati / [a] Batalkan semua: '),
      (answer) => {
        rl.close();
        const ans = answer.trim().toLowerCase();
        if (ans === 'a' || ans === 'abort') {
          reject(new Error('USER_ABORT: Sesi dihentikan oleh pengguna.'));
        } else {
          resolve(ans === 'y' || ans === 'yes' || ans === 'ya');
        }
      }
    );
  });
}
