"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionContext = void 0;
exports.getProjectDir = getProjectDir;
exports.log = log;
const async_hooks_1 = require("async_hooks");
const env_1 = require("../config/env");
const util_1 = require("util");
exports.executionContext = new async_hooks_1.AsyncLocalStorage();
/**
 * Gets the current project directory.
 * If running inside a Telegram Queue Context, it returns the session's project path.
 * Otherwise, it falls back to the globally configured env.TARGET_PROJECT_DIR.
 */
function getProjectDir() {
    const ctx = exports.executionContext.getStore();
    if (ctx && ctx.projectPath) {
        return ctx.projectPath;
    }
    // Fallback to global config (e.g. for CLI execution)
    const dir = env_1.env.TARGET_PROJECT_DIR;
    if (!dir)
        throw new Error('getProjectDir: No project directory configured and no execution context active.');
    return dir;
}
/**
 * Logs a message.
 * If running inside a Telegram Queue Context, it routes the log to the Telegram buffer.
 * Otherwise, it prints directly to standard output.
 */
function logContext(msg, bypassIntercept = false) {
    const ctx = exports.executionContext.getStore();
    if (ctx && ctx.logger && !bypassIntercept) {
        ctx.logger(msg);
    }
    else {
        // Write directly to stdout to bypass any global console monkey-patch
        process.stdout.write(msg + '\n');
    }
}
/**
 * Wrapper for console.log behavior.
 * Formats exactly like console.log but routes safely.
 */
function log(...args) {
    const msg = args.map(a => typeof a === 'string' ? a : (0, util_1.inspect)(a, { depth: 2, colors: false })).join(' ');
    logContext(msg);
}
