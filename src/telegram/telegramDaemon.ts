// Module: src/telegram/telegramDaemon.ts
// Tujuan: Daemon bot Telegram yang menerima prompt teks dari user yang terotorisasi dan menjalankan Ceobe autonomous pipeline secara remote.
// Caller: src/index.ts (via command `ceobe daemon --telegram`)
// Dependensi: node-telegram-bot-api, runAutonomousLoop, keyManager, MessageQueue, chalk, fs, path, context, stateManager
// Main Functions: startTelegramDaemon
// Side Effects: Membuka koneksi polling ke Telegram API. Menjalankan pipeline otonom.
// v2.0.0: Refactored command handlers for clean code.

import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { readAllKeys } from '../utils/keyManager';
import { runAutonomousLoop } from '../ai/supervisor';
import { MessageQueue } from './messageQueue';
import { getActiveMode, setConfirmationBridge, clearConfirmationBridge } from '../utils/modeManager';
import { TelegramHITLBridge } from './hitlBridge';
import { getActiveSession, switchSession, sessionStore } from './sessionManager';
import { readProjects } from '../utils/projectRegistry';
import { executionContext, log } from '../utils/context';

import {
  handleStartCommand,
  handleStatusCommand,
  handleModeCommand,
  handleHelpCommand,
  handleCancelCommand,
  handleCostCommand,
  handleLogsCommand,
  handleReadCommand,
  handleProjectsCommand,
  handleCdCommand,
  handleAddProjectCommand,
  handleResetCommand,
  handleIndexCommand,
  handleDoctorCommand
} from './handlers';

function getAllowedIds(raw: string): Set<number> {
  const ids = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  return new Set(ids);
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...\n\n[Dipotong oleh bot]' : str;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function startTelegramDaemon(): Promise<void> {
  const keys = readAllKeys();
  const token = keys.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const allowedRaw = keys.TELEGRAM_ALLOWED_USERS || process.env.TELEGRAM_ALLOWED_USERS || '';

  if (!token) {
    console.error(chalk.red('\n[TelegramDaemon] Gagal: TELEGRAM_BOT_TOKEN belum dikonfigurasi.'));
    console.error(chalk.yellow('  Jalankan: ceobe key set telegram-token <token>'));
    process.exit(1);
  }

  if (!allowedRaw) {
    console.error(chalk.red('\n[TelegramDaemon] Gagal: TELEGRAM_ALLOWED_USERS belum dikonfigurasi.'));
    console.error(chalk.yellow('  Jalankan: ceobe key set telegram-allowed-users <ids>'));
    process.exit(1);
  }

  const allowedIds = getAllowedIds(allowedRaw);
  const queue = new MessageQueue();

  console.log(chalk.magenta.bold('\n🤖 [Ceobe Telegram Daemon] Starting...\n'));
  console.log(chalk.dim(`  User yang diizinkan: ${[...allowedIds].join(', ')}`));
  console.log(chalk.dim('  Mode: Long Polling (tekan Ctrl+C untuk berhenti)\n'));

  const bot = new TelegramBot(token, { polling: true });

  bot.on('polling_error', (err) => {
    console.error(chalk.red(`[TelegramDaemon] Polling error: ${err.message}`));
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    let text = msg.text?.trim() ?? '';

    // Normalize command by removing @botname if present (for group chats)
    if (text.startsWith('/')) {
      const firstSpace = text.indexOf(' ');
      if (firstSpace !== -1) {
        const cmdPart = text.substring(0, firstSpace);
        const argsPart = text.substring(firstSpace);
        const baseCmd = cmdPart.split('@')[0];
        text = baseCmd + argsPart;
      } else {
        text = text.split('@')[0];
      }
    }

    // ── Security Gate: tolak user tidak terotorisasi ──────────────────────
    if (!userId || !allowedIds.has(userId)) {
      console.log(chalk.yellow(`[TelegramDaemon] Pesan dari user tidak terotorisasi (ID: ${userId}) → ditolak.`));
      await bot.sendMessage(chatId, '🔒 Unauthorized. Kamu tidak memiliki akses ke Ceobe.');
      return;
    }

    // Abaikan perintah Telegram bawaan (e.g., /start)
    if (text.startsWith('/')) {
      if (text === '/start') await handleStartCommand(bot, chatId);
      else if (text === '/status') await handleStatusCommand(bot, chatId, queue);
      else if (text === '/ask' || text === '/auto' || text.startsWith('/mode')) await handleModeCommand(bot, chatId, text);
      else if (text === '/help') await handleHelpCommand(bot, chatId);
      else if (text === '/cancel' || text === '/clear') await handleCancelCommand(bot, chatId, queue);
      else if (text === '/cost') await handleCostCommand(bot, chatId);
      else if (text === '/logs') await handleLogsCommand(bot, chatId);
      else if (text.startsWith('/read ')) await handleReadCommand(bot, chatId, text);
      else if (text === '/projects') await handleProjectsCommand(bot, chatId);
      else if (text.startsWith('/cd ')) await handleCdCommand(bot, chatId, text);
      else if (text.startsWith('/addproject ')) await handleAddProjectCommand(bot, chatId, text);
      else if (text === '/reset') await handleResetCommand(bot, chatId);
      else if (text === '/index') await handleIndexCommand(bot, chatId);
      else if (text === '/doctor') await handleDoctorCommand(bot, chatId);
      return;
    }

    // Assign default session if none exists
    if (!getActiveSession(chatId)) {
      const projects = readProjects();
      const firstProject = Object.keys(projects)[0];
      if (firstProject) {
        switchSession(chatId, firstProject);
      } else {
        // Fallback to process.cwd()
        sessionStore.set(chatId, { projectName: 'default', projectPath: process.cwd() });
      }
    }

    if (!text) {
      await bot.sendMessage(chatId, '⚠️ Tolong kirimkan deskripsi tugas sebagai teks.');
      return;
    }

    // ── Queue the task ────────────────────────────────────────────────────
    if (queue.isBusy) {
      await bot.sendMessage(chatId, '⏳ Ceobe sedang mengerjakan tugas sebelumnya. Tugasmu sudah ditambahkan ke antrian.');
    } else {
      const safeText = escapeHtml(truncate(text, 300));
      await bot.sendMessage(chatId, `📋 <b>Tugas diterima!</b>\n\n${safeText}\n\nCeobe mulai bekerja...`, { parse_mode: 'HTML' });
    }

    queue.enqueue(async () => {
      const logBuffer: string[] = [];
      let lastFlush = Date.now();

      const sendLogs = async () => {
        if (logBuffer.length === 0) return;
        const chunk = logBuffer.splice(0, logBuffer.length).join('\n');
        try {
          await bot.sendMessage(chatId, `<pre><code>${escapeHtml(truncate(chunk, 3800))}</code></pre>`, { parse_mode: 'HTML' });
        } catch {
          // Ignore Telegram rate limit / message errors silently
        }
      };

      const loggerFn = (line: string) => {
        logBuffer.push(line);
        if (Date.now() - lastFlush > 5000 || logBuffer.length >= 30) {
          lastFlush = Date.now();
          sendLogs().catch(() => {});
        }
      };

      const activeProject = getActiveSession(chatId);
      const projectPath = activeProject ? activeProject.projectPath : process.cwd();

      await executionContext.run({ projectPath, logger: loggerFn }, async () => {
        try {
          log(`\n[TelegramDaemon] Menjalankan pipeline untuk: "${text.substring(0, 80)}..."`);
          
          if (activeProject) {
            log(`[TelegramDaemon] Working in project: ${activeProject.projectName} (${projectPath})`);
          }

          if (getActiveMode() === 'ask') {
            const bridge = new TelegramHITLBridge(bot, chatId);
            setConfirmationBridge(bridge);
          }

          await runAutonomousLoop(text, getActiveMode() === 'ask', false);
          await sendLogs(); 
          await bot.sendMessage(chatId, '🎉 <b>Pipeline selesai!</b> Codebase telah diperbarui oleh Ceobe.', { parse_mode: 'HTML' });
        } catch (err: unknown) {
          await sendLogs();
          const msg = err instanceof Error ? err.message : String(err);
          await bot.sendMessage(chatId, `❌ <b>Pipeline gagal.</b>\n<pre><code>${escapeHtml(truncate(msg, 1000))}</code></pre>`, { parse_mode: 'HTML' });
        } finally {
          clearConfirmationBridge();
        }
      });
    });
  });

  return new Promise(() => {
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n[TelegramDaemon] Shutting down... Waiting for pending tasks to finish.'));
      bot.stopPolling();
      await queue.waitUntilDrained();
      console.log(chalk.green('[TelegramDaemon] All tasks finished. Exiting.'));
      process.exit(0);
    });
  });
}
