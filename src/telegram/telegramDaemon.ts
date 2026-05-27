// Module: src/telegram/telegramDaemon.ts
// Tujuan: Daemon bot Telegram yang menerima prompt teks dari user yang terotorisasi
//         dan menjalankan Ceobe autonomous pipeline secara remote.
// Caller: src/index.ts (via command `ceobe daemon --telegram`)
// Dependensi: node-telegram-bot-api, runAutonomousLoop, keyManager, MessageQueue, chalk
// Main Functions: startTelegramDaemon
// Side Effects: Membuka koneksi polling ke Telegram API. Menjalankan pipeline otonom.
// v1.7.0: Modul baru — Fase 3 dari Ceobe Enterprise Upgrade.

import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { readAllKeys } from '../utils/keyManager';
import { runAutonomousLoop } from '../ai/supervisor';
import { MessageQueue } from './messageQueue';
import { getActiveMode, setMode, setConfirmationBridge, clearConfirmationBridge } from '../utils/modeManager';
import { TelegramHITLBridge } from './hitlBridge';
import { getActiveSession, switchSession, sessionStore } from './sessionManager';
import { readProjects, registerProject } from '../utils/projectRegistry';
import { env } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';
import { getSessionCost } from '../utils/costTracker';

// ── Telegram helper: memisahkan banyak user ID dari satu string ───────────────
function getAllowedIds(raw: string): Set<number> {
  const ids = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  return new Set(ids);
}

// ── Trim pesan agar aman untuk ditampilkan di Telegram ───────────────────────
function truncate(msg: string, max = 4000): string {
  return msg.length > max ? msg.substring(0, max) + '\n…[terpotong]' : msg;
}

/**
 * Starts the Ceobe Telegram daemon using Long Polling.
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USERS from ~/.ceobe/keys.json.
 */
export async function startTelegramDaemon(): Promise<void> {
  const keys = readAllKeys();
  const token = keys['TELEGRAM_BOT_TOKEN'] || process.env['TELEGRAM_BOT_TOKEN'] || '';
  const allowedRaw = keys['TELEGRAM_ALLOWED_USERS'] || process.env['TELEGRAM_ALLOWED_USERS'] || '';

  // ── Pre-flight validation ──────────────────────────────────────────────────
  if (!token) {
    console.error(chalk.red('[TelegramDaemon] ❌ TELEGRAM_BOT_TOKEN belum diset.'));
    console.error(chalk.yellow('  Atur dengan: ceobe key set telegram-token <BOT_TOKEN>'));
    process.exit(1);
  }
  if (!allowedRaw) {
    console.error(chalk.red('[TelegramDaemon] ❌ TELEGRAM_ALLOWED_USERS belum diset.'));
    console.error(chalk.yellow('  Atur dengan: ceobe key set telegram-allowed-users <USER_ID_1,USER_ID_2>'));
    console.error(chalk.dim('  Cara cari User ID: kirim pesan ke @userinfobot di Telegram.'));
    process.exit(1);
  }

  const allowedIds = getAllowedIds(allowedRaw);
  const queue = new MessageQueue();

  console.log(chalk.magenta.bold('\n🤖 [Ceobe Telegram Daemon] Starting...\n'));
  console.log(chalk.dim(`  User yang diizinkan: ${[...allowedIds].join(', ')}`));
  console.log(chalk.dim('  Mode: Long Polling (tekan Ctrl+C untuk berhenti)\n'));

  const bot = new TelegramBot(token, { polling: true });

  // ── Pesan sambutan saat daemon siap ──────────────────────────────────────
  bot.on('polling_error', (err) => {
    console.error(chalk.red(`[TelegramDaemon] Polling error: ${err.message}`));
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim() ?? '';

    // ── Security Gate: tolak user tidak terotorisasi ──────────────────────
    if (!userId || !allowedIds.has(userId)) {
      console.log(chalk.yellow(`[TelegramDaemon] Pesan dari user tidak terotorisasi (ID: ${userId}) → ditolak.`));
      await bot.sendMessage(chatId, '🔒 Unauthorized. Kamu tidak memiliki akses ke Ceobe.');
      return;
    }

    // Abaikan perintah Telegram bawaan (e.g., /start)
    if (text.startsWith('/')) {
      if (text === '/start') {
        await bot.sendMessage(
          chatId,
          '👋 Halo! Saya *Ceobe*, AI Engineering Orchestrator Anda.\n\nKirimkan saya deskripsi proyek atau fitur yang ingin Anda bangun, dan saya akan mengerjakannya secara otomatis! 🚀',
          { parse_mode: 'Markdown' }
        );
      } else if (text === '/status') {
        const busy = queue.isBusy;
        const currentMode = getActiveMode();
        await bot.sendMessage(chatId, busy ? `⚙️ Ceobe sedang mengerjakan tugas (Mode: ${currentMode})...` : `✅ Ceobe siap menerima tugas (Mode: ${currentMode}).`);
      } else if (text === '/ask') {
        const newMode = getActiveMode() === 'autonomous' ? 'ask' : 'autonomous';
        setMode(newMode);
        await bot.sendMessage(chatId, `🔄 Mode diubah ke: *${newMode}*\n\n${newMode === 'ask' ? '🙋 Ceobe akan meminta persetujuanmu via tombol Telegram sebelum aksi berbahaya.' : '🤖 Ceobe akan mengeksekusi semua aksi secara otonom tanpa konfirmasi.'}`, { parse_mode: 'Markdown' });
      } else if (text === '/help') {
        const helpText = `🤖 *Panduan Ceobe Telegram Daemon*\n\n` +
          `ℹ️ *Informasi & Status*\n` +
          `\`/status\` - Melihat status agen dan mode aktif.\n` +
          `\`/cost\` - Melihat estimasi biaya API di sesi ini.\n` +
          `\`/logs\` - Menampilkan 50 baris terakhir log eksekusi.\n` +
          `\`/read <dokumen>\` - Mengirim file dokumen (opsi: brd, design, arch, task, devops).\n\n` +
          `⚙️ *Kontrol & Mode*\n` +
          `\`/ask\` - Toggle konfirmasi manual (ask) vs otonom.\n` +
          `\`/cancel\` - Mengosongkan antrean tugas (membatalkan tugas yang belum berjalan).\n\n` +
          `📁 *Manajemen Workspace*\n` +
          `\`/projects\` - List semua workspace.\n` +
          `\`/cd <nama>\` - Berpindah proyek.\n` +
          `\`/addproject <nama> <path_absolut>\` - Mendaftarkan proyek baru.\n\n` +
          `💡 *Kirimkan perintah dalam teks biasa (tanpa garis miring) untuk memulai tugas.*`;
        await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
      } else if (text === '/cancel' || text === '/clear') {
        const cleared = queue.clear();
        await bot.sendMessage(chatId, `🛑 Antrean dikosongkan. ${cleared} tugas yang belum dimulai telah dibatalkan.\n\n_(Catatan: Jika ada tugas yang sedang aktif berjalan, ia akan tetap berlanjut sampai siklusnya selesai)_`, { parse_mode: 'Markdown' });
      } else if (text === '/cost') {
        const cost = getSessionCost();
        await bot.sendMessage(chatId, `💰 *Estimasi Biaya Sesi Ini*\nTotal tagihan API sejak agen hidup: *$${cost.toFixed(4)} USD*`, { parse_mode: 'Markdown' });
      } else if (text === '/logs') {
        const active = getActiveSession(chatId);
        const pPath = active ? active.projectPath : process.cwd();
        const logPath = path.join(pPath, '.ceobe', 'execution.log');
        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.trim().split('\n');
          const lastLines = lines.slice(-50).join('\n');
          await bot.sendMessage(chatId, `📜 *50 Baris Terakhir Log (${active?.projectName || 'default'})*\n\n\`\`\`\n${truncate(lastLines, 3800)}\n\`\`\``, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, `ℹ️ Belum ada log eksekusi di proyek ini (\`.ceobe/execution.log\` tidak ditemukan).`);
        }
      } else if (text.startsWith('/read ')) {
        const docType = text.substring(6).trim().toLowerCase();
        const validDocs: Record<string, string> = {
          brd: 'brd.md',
          design: 'design.md',
          arch: 'architecture.md',
          architecture: 'architecture.md',
          task: 'task.md',
          devops: 'devops.md'
        };

        if (!(docType in validDocs)) {
          await bot.sendMessage(chatId, `⚠️ Dokumen tidak dikenali. Pilih salah satu:\n\`/read brd\`\n\`/read design\`\n\`/read arch\`\n\`/read task\`\n\`/read devops\``, { parse_mode: 'Markdown' });
        } else {
          const active = getActiveSession(chatId);
          const pPath = active ? active.projectPath : process.cwd();
          const docPath = path.join(pPath, '.ceobe', validDocs[docType]);
          
          if (!fs.existsSync(docPath)) {
            await bot.sendMessage(chatId, `ℹ️ Dokumen *${validDocs[docType]}* belum dibuat di proyek ini.`, { parse_mode: 'Markdown' });
          } else {
            await bot.sendDocument(chatId, docPath, { caption: `📄 Dokumen: ${validDocs[docType]}` });
          }
        }
      } else if (text === '/projects') {
        const projects = readProjects();
        const active = getActiveSession(chatId);
        if (Object.keys(projects).length === 0) {
          await bot.sendMessage(chatId, '📁 Belum ada project terdaftar.\nGunakan `/addproject <name> <absolute_path>` untuk menambahkan.', { parse_mode: 'Markdown' });
        } else {
          let reply = '📁 *Daftar Project*\n\n';
          for (const [name, pPath] of Object.entries(projects)) {
            const isAct = active?.projectName === name ? '✅ (Aktif)' : '';
            reply += `- *${name}* \`${pPath}\` ${isAct}\n`;
          }
          reply += '\nGunakan `/cd <name>` untuk berpindah project.';
          await bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
        }
      } else if (text.startsWith('/cd ')) {
        const targetName = text.substring(4).trim();
        if (switchSession(chatId, targetName)) {
          await bot.sendMessage(chatId, `📂 Project aktif diubah ke: *${targetName}*`, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, `❌ Project '${targetName}' tidak ditemukan.\nGunakan /projects untuk melihat daftar.`, { parse_mode: 'Markdown' });
        }
      } else if (text.startsWith('/addproject ')) {
        const args = text.substring(12).trim().split(' ');
        if (args.length < 2) {
          await bot.sendMessage(chatId, `⚠️ Format salah. Gunakan:\n\`/addproject <name> <absolute_path>\``, { parse_mode: 'Markdown' });
        } else {
          const name = args[0];
          const targetPath = args.slice(1).join(' ');
          registerProject(name, targetPath);
          await bot.sendMessage(chatId, `✅ Project *${name}* berhasil didaftarkan.`, { parse_mode: 'Markdown' });
        }
      }
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
      await bot.sendMessage(chatId, `📋 *Tugas diterima!*\n\n> ${truncate(text, 300)}\n\nCeobe mulai bekerja...`, { parse_mode: 'Markdown' });
    }

    queue.enqueue(async () => {
      console.log(chalk.blue(`\n[TelegramDaemon] Menjalankan pipeline untuk: "${text.substring(0, 80)}..."`));

      // Intercept console.log selama eksekusi dan kirim ke Telegram secara berkala
      const logBuffer: string[] = [];
      let lastFlush = Date.now();
      const originalLog = console.log;

      const sendLogs = async () => {
        if (logBuffer.length === 0) return;
        const chunk = logBuffer.splice(0, logBuffer.length).join('\n');
        try {
          await bot.sendMessage(chatId, `\`\`\`\n${truncate(chunk, 3800)}\n\`\`\``, { parse_mode: 'Markdown' });
        } catch {
          // Ignore Telegram rate limit / message errors silently
        }
      };

      console.log = (...args: unknown[]) => {
        const line = args.map((a) => (typeof a === 'string' ? a.replace(/\x1b\[[0-9;]*m/g, '') : String(a))).join(' ');
        originalLog(...args); // Tetap tampilkan di terminal lokal
        logBuffer.push(line);
        // Flush ke Telegram setiap 5 detik atau setiap 30 baris
        if (Date.now() - lastFlush > 5000 || logBuffer.length >= 30) {
          lastFlush = Date.now();
          sendLogs().catch(() => {});
        }
      };

      try {
        // Set dynamic TARGET_PROJECT_DIR based on session
        const activeProject = getActiveSession(chatId);
        if (activeProject) {
          env.TARGET_PROJECT_DIR = activeProject.projectPath;
          process.chdir(env.TARGET_PROJECT_DIR); // Change working directory for commands
          console.log(chalk.blue(`[TelegramDaemon] Working in project: ${activeProject.projectName} (${env.TARGET_PROJECT_DIR})`));
        }

        // Daftarkan Telegram Bridge jika pipeline berjalan dalam mode ask
        if (getActiveMode() === 'ask') {
          const bridge = new TelegramHITLBridge(bot, chatId);
          setConfirmationBridge(bridge);
        }

        await runAutonomousLoop(text, false, false);
        await sendLogs(); // Flush sisa log
        await bot.sendMessage(chatId, '🎉 *Pipeline selesai!* Codebase telah diperbarui oleh Ceobe.', { parse_mode: 'Markdown' });
      } catch (err: unknown) {
        await sendLogs();
        const msg = err instanceof Error ? err.message : String(err);
        await bot.sendMessage(chatId, `❌ *Pipeline gagal.*\n\`\`\`\n${truncate(msg, 1000)}\n\`\`\``, { parse_mode: 'Markdown' });
      } finally {
        console.log = originalLog; // Restore console.log
        clearConfirmationBridge(); // Bersihkan bridge setelah loop selesai
      }
    });
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n[TelegramDaemon] Shutting down...'));
    bot.stopPolling();
    process.exit(0);
  });
}
