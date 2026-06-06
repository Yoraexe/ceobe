import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveSession } from '../sessionManager';
import { MessageQueue } from '../messageQueue';
import { getSessionCost } from '../../utils/costTracker';

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...\n\n[Dipotong oleh bot]' : str;
}

export async function handleCancelCommand(bot: TelegramBot, chatId: number, queue: MessageQueue) {
  const cleared = queue.clear();
  await bot.sendMessage(chatId, `🛑 Antrean dikosongkan. ${cleared} tugas yang belum dimulai telah dibatalkan.\n\n_(Catatan: Jika ada tugas yang sedang aktif berjalan, ia akan tetap berlanjut sampai siklusnya selesai)_`, { parse_mode: 'Markdown' });
}

export async function handleCostCommand(bot: TelegramBot, chatId: number) {
  const cost = getSessionCost();
  await bot.sendMessage(chatId, `💰 *Estimasi Biaya Sesi Ini*\nTotal tagihan API sejak agen hidup: *$${cost.toFixed(4)} USD*`, { parse_mode: 'Markdown' });
}

export async function handleLogsCommand(bot: TelegramBot, chatId: number) {
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
}

export async function handleReadCommand(bot: TelegramBot, chatId: number, text: string) {
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
}
