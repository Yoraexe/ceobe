// Tujuan: Menyediakan penyimpanan konteks eksekusi asinkron (AsyncLocalStorage) untuk Ceobe.
// Caller: Seluruh modul di src/ (supervisor, executor, tools, telegram, utils)
// Dependensi: async_hooks, config/env, util
// Main Functions: executionContext, getProjectDir, log
// Side Effects: Tidak ada.

import { AsyncLocalStorage } from 'async_hooks';
import { env } from '../config/env';
import { inspect } from 'util';

export interface CeobeContext {
  projectPath: string;
  logger?: (msg: string) => void;
  confirmationBridge?: { requestConfirmation: (summary: string) => Promise<boolean> };
  sessionUsage?: Array<{ model: string; inputTokens: number; outputTokens: number }>;
  snapshots?: Map<string, { hash: string; timestamp: number; version: number }>;
  stateCache?: unknown;
  configCache?: unknown;
  mode?: 'autonomous' | 'ask';
}

export const executionContext = new AsyncLocalStorage<CeobeContext>();

/**
 * Gets the current project directory.
 * If running inside a Telegram Queue Context, it returns the session's project path.
 * Otherwise, it falls back to the globally configured env.TARGET_PROJECT_DIR.
 */
export function getProjectDir(): string {
  const ctx = executionContext.getStore();
  if (ctx && ctx.projectPath) {
    return ctx.projectPath;
  }
  // Fallback to global config (e.g. for CLI execution)
  const dir = env.TARGET_PROJECT_DIR;
  if (!dir) throw new Error('getProjectDir: No project directory configured and no execution context active.');
  return dir;
}

/**
 * Logs a message.
 * If running inside a Telegram Queue Context, it routes the log to the Telegram buffer.
 * Otherwise, it prints directly to standard output.
 */
function logContext(msg: string, bypassIntercept = false): void {
  const ctx = executionContext.getStore();
  if (ctx && ctx.logger && !bypassIntercept) {
    ctx.logger(msg);
  } else {
    if (process.env.CEOBE_MCP_MODE === 'true') {
      process.stderr.write(msg + '\n');
    } else {
      // Write directly to stdout to bypass any global console monkey-patch
      process.stdout.write(msg + '\n');
    }
  }
}

/**
 * Wrapper for console.log behavior.
 * Formats exactly like console.log but routes safely.
 */
export function log(...args: unknown[]): void {
  const msg = args.map(a => typeof a === 'string' ? a : inspect(a, { depth: 2, colors: false })).join(' ');
  logContext(msg);
}
