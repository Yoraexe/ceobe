// Tujuan: Daemon bot Telegram yang menerima prompt teks dari user yang terotorisasi dan menjalankan Ceobe autonomous pipeline secara remote.
// Caller: src/index.ts (via command `ceobe daemon --telegram`)
// Dependensi: node-telegram-bot-api, runAutonomousLoop, keyManager, MessageQueue, chalk, fs, path, context, stateManager
// Main Functions: startTelegramDaemon
// Side Effects: Membuka koneksi polling ke Telegram API. Menjalankan pipeline otonom.
// v1.9.0: Ditambahkan utilitas (/index, /doctor, /reset) dan validasi path sistem.

import TelegramBot from 'node-telegram-bot-api';
import chalk from 'chalk';
import { readAllKeys } from '../utils/keyManager';
import { runAutonomousLoop } from '../ai/supervisor';
import { MessageQueue } from './messageQueue';
import { getActiveMode, setMode, setConfirmationBridge, clearConfirmationBridge } from '../utils/modeManager';
import { TelegramHITLBridge } from './hitlBridge';
import { getActiveSession, switchSession, sessionStore } from './sessionManager';
import { readProjects, registerProject } from '../utils/projectRegistry';
import { clearStateCache } from '../utils/stateManager';
import * as fs from 'fs';
import * as path from 'path';
import { getSessionCost } from '../utils/costTracker';
import { executionContext, log } from '../utils/context';

// ── Telegram helper: memisahkan banyak user ID dari satu string ───────────────
function getAllowedIds(raw: string): Set<number> {
  const ids = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  return new Set(ids);
}

// Helper untuk truncate string panjang
function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...\n\n[Dipotong oleh bot]' : str;
}

export function startTelegramDaemon(): void {
  const keys = readAllKeys();
  const token = keys.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN || '';
  const allowedRaw = keys.TELEGRAM_ALLOWED_USERS || process.env.TELEGRAM_ALLOWED_USERS || '';

  if (!token) {
    console.error(chalk.red('\n[TelegramDaemon] Gagal: TELEGRAM_TOKEN belum dikonfigurasi.'));
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
        const active = getActiveSession(chatId);
        const pPath = active ? active.projectPath : process.cwd();
        await executionContext.run({ projectPath: pPath }, async () => {
          const busy = queue.isBusy;
          const currentMode = getActiveMode();
          await bot.sendMessage(chatId, busy ? `⚙️ Ceobe sedang mengerjakan tugas (Mode: ${currentMode})...` : `✅ Ceobe siap menerima tugas (Mode: ${currentMode}).`);
        });
      } else if (text === '/ask' || text === '/auto' || text.startsWith('/mode')) {
        const active = getActiveSession(chatId);
        const pPath = active ? active.projectPath : process.cwd();
        await executionContext.run({ projectPath: pPath }, async () => {
          let newMode = getActiveMode();
          if (text === '/ask') newMode = 'ask';
          else if (text === '/auto') newMode = 'autonomous';
          else if (text.startsWith('/mode ')) {
            const requested = text.split(' ')[1]?.trim().toLowerCase();
            if (requested === 'ask' || requested === 'autonomous') {
              newMode = requested as 'ask' | 'autonomous';
            } else {
              await bot.sendMessage(chatId, '❌ Perintah tidak valid. Gunakan `/mode ask` atau `/mode autonomous`.', { parse_mode: 'Markdown' });
              return;
            }
          } else {
            await bot.sendMessage(chatId, `ℹ️ Mode saat ini: *${newMode}*\nKetik \`/mode ask\` atau \`/mode autonomous\` untuk mengubahnya.`, { parse_mode: 'Markdown' });
            return;
          }
          setMode(newMode);
          await bot.sendMessage(chatId, `🔄 Mode diatur ke: *${newMode}*\n\n${newMode === 'ask' ? '🙋 Ceobe akan meminta persetujuanmu via tombol Telegram sebelum aksi berbahaya.' : '🤖 Ceobe akan mengeksekusi semua aksi secara otonom tanpa konfirmasi.'}`, { parse_mode: 'Markdown' });
        });
      } else if (text === '/help') {
        const helpText = `🤖 *Panduan Ceobe Telegram Daemon*\n\n` +
          `ℹ️ *Informasi & Status*\n` +
          `\`/status\` - Melihat status agen dan mode aktif.\n` +
          `\`/cost\` - Melihat estimasi biaya API di sesi ini.\n` +
          `\`/logs\` - Menampilkan 50 baris terakhir log eksekusi.\n` +
          `\`/read <dokumen>\` - Mengirim file dokumen (opsi: brd, design, arch, task, devops).\n\n` +
          `⚙️ *Kontrol & Mode*\n` +
          `\`/mode <ask|autonomous>\` - Mengatur mode eksekusi.\n` +
          `\`/ask\` - Jalan pintas ke mode konfirmasi manual.\n` +
          `\`/auto\` - Jalan pintas ke mode otonom penuh.\n` +
          `\`/cancel\` - Mengosongkan antrean tugas (membatalkan tugas yang belum berjalan).\n\n` +
          `📁 *Manajemen Workspace*\n` +
          `\`/projects\` - List semua workspace.\n` +
          `\`/cd <nama>\` - Berpindah proyek.\n` +
          `\`/addproject <nama> <path_absolut>\` - Mendaftarkan proyek baru.\n\n` +
          `🧠 *Utilitas & Diagnostik*\n` +
          `\`/index\` - Melakukan indeksing ulang RAG untuk project saat ini.\n` +
          `\`/doctor\` - Menjalankan pemeriksaan API key, dependency, dan status workspace.\n` +
          `\`/reset\` - Mereset status pipeline (state) project saat ini.\n\n` +
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
          const stats = fs.statSync(logPath);
          let content = '';
          if (stats.size > 50000) {
            const fd = fs.openSync(logPath, 'r');
            const bufferSize = 50000;
            const buffer = Buffer.alloc(bufferSize);
            fs.readSync(fd, buffer, 0, bufferSize, stats.size - bufferSize);
            fs.closeSync(fd);
            content = buffer.toString('utf8');
          } else {
            content = fs.readFileSync(logPath, 'utf8');
          }
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
          clearStateCache();
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
          const absolutePath = path.resolve(targetPath);
          const isSystemDir = absolutePath === '/' || /^[a-zA-Z]:\\\\?$/.test(absolutePath) || absolutePath.toLowerCase().includes('windows\\system32') || absolutePath.toLowerCase().includes('/etc');
          
          if (isSystemDir) {
            await bot.sendMessage(chatId, `🚫 Path *${absolutePath}* ditolak karena merupakan direktori sistem.`, { parse_mode: 'Markdown' });
          } else if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
            await bot.sendMessage(chatId, `❌ Gagal: Path tidak ditemukan atau bukan sebuah direktori:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
          } else {
            registerProject(name, absolutePath);
            await bot.sendMessage(chatId, `✅ Project *${name}* berhasil didaftarkan.`, { parse_mode: 'Markdown' });
          }
        }
      } else if (text === '/reset') {
        const active = getActiveSession(chatId);
        const pPath = active ? active.projectPath : process.cwd();
        const statePath = path.join(pPath, '.ceobe', 'ceobe-state.json');
        if (fs.existsSync(statePath)) {
          try {
            fs.unlinkSync(statePath);
            clearStateCache();
            await bot.sendMessage(chatId, `✅ State untuk project *${active?.projectName || 'default'}* berhasil di-reset.`, { parse_mode: 'Markdown' });
          } catch (e: any) {
            await bot.sendMessage(chatId, `❌ Gagal me-reset state: ${e.message}`, { parse_mode: 'Markdown' });
          }
        } else {
          await bot.sendMessage(chatId, `ℹ️ Tidak ada data state aktif untuk di-reset di project ini.`, { parse_mode: 'Markdown' });
        }
      } else if (text === '/index') {
        const active = getActiveSession(chatId);
        const pPath = active ? active.projectPath : process.cwd();
        await bot.sendMessage(chatId, `🧠 Memulai pengindeksan RAG untuk *${active?.projectName || 'default'}*...`);
        try {
          await executionContext.run({ projectPath: pPath }, async () => {
            const { indexWorkspace } = require('../ai/memory/indexer');
            await indexWorkspace();
          });
          await bot.sendMessage(chatId, `✅ Pengindeksan RAG selesai! Semantic memory siap digunakan.`);
        } catch (e: any) {
          await bot.sendMessage(chatId, `❌ Gagal melakukan pengindeksan: ${e.message}`);
        }
      } else if (text === '/doctor') {
        try {
          const active = getActiveSession(chatId);
          await bot.sendMessage(chatId, `🩺 Menjalankan Ceobe Diagnostic Tool untuk *${active?.projectName || 'default'}*...`);
          
          let output = '🩺 *Ceobe Diagnostic Report*\n\n';
          
          const rawPlanner = process.env.CEOBE_PLANNER_PROVIDER || '';
          const rawExecutor = process.env.CEOBE_EXECUTOR_PROVIDER || '';
          const plannerProvider = rawPlanner || rawExecutor || '(not set)';
          const executorProvider = rawExecutor || rawPlanner || '(not set)';
          const plannerModel = process.env.CEOBE_PLANNER_MODEL || '(default model)';
          const executorModel = process.env.CEOBE_EXECUTOR_MODEL || '(default model)';
          const embeddingProvider = process.env.CEOBE_EMBEDDING_PROVIDER || plannerProvider;

          output += `*0. Active Provider Configuration:*\n`;
          output += `  Planner  → ${plannerProvider} / ${plannerModel}\n`;
          output += `  Executor → ${executorProvider} / ${executorModel}\n`;
          output += `  Embedding→ ${embeddingProvider}\n\n`;

          output += `*1. API Keys Status:*\n`;
          const { readAllKeys, KEY_DEFINITIONS, getRequiredKeyForActiveProviders } = require('../utils/keyManager');
          const storedKeys = readAllKeys();
          const requiredEnvKeys = getRequiredKeyForActiveProviders();
          for (const envKey of requiredEnvKeys) {
            const def = KEY_DEFINITIONS.find((d: any) => d.envKey === envKey);
            const value = storedKeys[envKey] || process.env[envKey];
            if (!value) {
              output += `  ✗ ${def?.label || envKey} is *MISSING*\n`;
            } else {
              output += `  ✓ ${def?.label || envKey} is configured.\n`;
            }
          }
          
          output += `\n*2. System Dependencies Check:*\n`;
          const { exec } = require('child_process');
          const checkDep = (name: string, cmd: string) => new Promise<string>((res) => {
            exec(cmd, (err: any, stdout: string) => {
              if (err) res(`  ✗ ${name}: Not found\n`);
              else res(`  ✓ ${name}: Available (${stdout.trim()})\n`);
            });
          });
          output += await checkDep('Node.js', 'node -v');
          output += await checkDep('npm', 'npm -v');
          output += await checkDep('Docker', 'docker -v');
          output += await checkDep('Git', 'git --version');
          
          await bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
        } catch (e: any) {
          await bot.sendMessage(chatId, `❌ Gagal menjalankan diagnostic: ${e.message}`);
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
      // Intercept console.log selama eksekusi dan kirim ke Telegram secara berkala
      const logBuffer: string[] = [];
      let lastFlush = Date.now();

      const sendLogs = async () => {
        if (logBuffer.length === 0) return;
        const chunk = logBuffer.splice(0, logBuffer.length).join('\n');
        try {
          await bot.sendMessage(chatId, `\`\`\`\n${truncate(chunk, 3800)}\n\`\`\``, { parse_mode: 'Markdown' });
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

          // Daftarkan Telegram Bridge jika pipeline berjalan dalam mode ask
          if (getActiveMode() === 'ask') {
            const bridge = new TelegramHITLBridge(bot, chatId);
            setConfirmationBridge(bridge);
          }

          await runAutonomousLoop(text, getActiveMode() === 'ask', false);
          await sendLogs(); // Flush sisa log
          await bot.sendMessage(chatId, '🎉 *Pipeline selesai!* Codebase telah diperbarui oleh Ceobe.', { parse_mode: 'Markdown' });
        } catch (err: unknown) {
          await sendLogs();
          const msg = err instanceof Error ? err.message : String(err);
          await bot.sendMessage(chatId, `❌ *Pipeline gagal.*\n\`\`\`\n${truncate(msg, 1000)}\n\`\`\``, { parse_mode: 'Markdown' });
        } finally {
          clearConfirmationBridge(); // Bersihkan bridge setelah loop selesai
        }
      });
    });
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n[TelegramDaemon] Shutting down...'));
    bot.stopPolling();
    process.exit(0);
  });
}
