// Tujuan: Menangani manajemen proyek Telegram seperti pergantian sesi kerja aktif '/cd' dan pendaftaran proyek baru '/addproject'.
// Caller: src/telegram/telegramDaemon.ts
// Dependensi: node-telegram-bot-api, utils/projectRegistry, telegram/sessionManager, utils/context
// Main Functions: handleProjectsCommand
// Side Effects: Tidak ada.

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveSession, switchSession } from '../sessionManager';
import { readProjects, registerProject } from '../../utils/projectRegistry';
import { clearStateCache } from '../../utils/stateManager';
import { executionContext } from '../../utils/context';
import { indexWorkspace } from '../../ai/memory/indexer';

export async function handleProjectsCommand(bot: TelegramBot, chatId: number) {
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
}

export async function handleCdCommand(bot: TelegramBot, chatId: number, text: string) {
  const targetName = text.substring(4).trim();
  if (switchSession(chatId, targetName)) {
    clearStateCache();
    await bot.sendMessage(chatId, `📂 Project aktif diubah ke: *${targetName}*`, { parse_mode: 'Markdown' });
  } else {
    await bot.sendMessage(chatId, `❌ Project '${targetName}' tidak ditemukan.\nGunakan /projects untuk melihat daftar.`, { parse_mode: 'Markdown' });
  }
}

export async function handleAddProjectCommand(bot: TelegramBot, chatId: number, text: string) {
  const args = text.substring(12).trim().split(' ');
  if (args.length < 2) {
    await bot.sendMessage(chatId, `⚠️ Format salah. Gunakan:\n\`/addproject <name> <absolute_path>\``, { parse_mode: 'Markdown' });
  } else {
    const name = args[0];
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      await bot.sendMessage(chatId, '❌ Nama project hanya boleh berisi huruf, angka, "-", "_", dan ".".', { parse_mode: 'Markdown' });
      return;
    }
    const targetPath = args.slice(1).join(' ');
    const absolutePath = path.resolve(targetPath);
    
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      await bot.sendMessage(chatId, `❌ Gagal: Path tidak ditemukan atau bukan sebuah direktori:\n\`${absolutePath}\``, { parse_mode: 'Markdown' });
      return;
    }

    let realPath: string;
    try {
      realPath = fs.realpathSync(absolutePath);
    } catch {
      realPath = absolutePath;
    }

    const isSystemDir = 
      realPath === '/' || 
      /^[a-zA-Z]:[\\/]*$/.test(realPath) || 
      /^[a-zA-Z]:[\\/]+Windows/i.test(realPath) || 
      /^[a-zA-Z]:[\\/]+Program Files/i.test(realPath) || 
      /^\/(etc|var|root|usr|bin|sbin|sys|proc|dev)(\/|$)/.test(realPath) ||
      /[\\/]\.(ssh|gnupg|aws|kube|docker|git)($|[\\/])/i.test(realPath);
    
    if (isSystemDir) {
      await bot.sendMessage(chatId, `🚫 Path *${realPath}* ditolak karena merupakan direktori sistem atau area sensitif.`, { parse_mode: 'Markdown' });
    } else {
      registerProject(name, realPath);
      await bot.sendMessage(chatId, `✅ Project *${name}* berhasil didaftarkan.`, { parse_mode: 'Markdown' });
    }
  }
}

export async function handleResetCommand(bot: TelegramBot, chatId: number) {
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
}

export async function handleIndexCommand(bot: TelegramBot, chatId: number) {
  const active = getActiveSession(chatId);
  const pPath = active ? active.projectPath : process.cwd();
  await bot.sendMessage(chatId, `🧠 Memulai pengindeksan RAG untuk *${active?.projectName || 'default'}*...`);
  try {
    await executionContext.run({ projectPath: pPath }, async () => {
      await indexWorkspace();
    });
    await bot.sendMessage(chatId, `✅ Pengindeksan RAG selesai! Semantic memory siap digunakan.`);
  } catch (e: any) {
    await bot.sendMessage(chatId, `❌ Gagal melakukan pengindeksan: ${e.message}`);
  }
}
