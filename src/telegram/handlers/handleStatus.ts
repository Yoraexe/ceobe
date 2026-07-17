// Tujuan: Menangani perintah bot Telegram '/status' dan '/mode' untuk mengubah mode eksekusi aktif (otonom/ask) secara remote.
// Caller: src/telegram/telegramDaemon.ts
// Dependensi: node-telegram-bot-api, telegram/sessionManager, utils/context, telegram/messageQueue, utils/modeManager
// Main Functions: handleStatusCommand, handleModeCommand
// Side Effects: Mengubah konfigurasi mode eksekusi aktif pada proyek target dan mengirim pesan konfirmasi ke Telegram.

import TelegramBot from 'node-telegram-bot-api';
import { getActiveSession } from '../sessionManager';
import { executionContext } from '../../utils/context';
import { MessageQueue } from '../messageQueue';
import { getActiveMode, setMode } from '../../utils/modeManager';

export async function handleStatusCommand(bot: TelegramBot, chatId: number, queue: MessageQueue) {
  const active = getActiveSession(chatId);
  const pPath = active ? active.projectPath : process.cwd();
  await executionContext.run({ projectPath: pPath }, async () => {
    const busy = queue.isBusy;
    const currentMode = getActiveMode();
    await bot.sendMessage(chatId, busy ? `⚙️ Ceobe sedang mengerjakan tugas (Mode: ${currentMode})...` : `✅ Ceobe siap menerima tugas (Mode: ${currentMode}).`);
  });
}

export async function handleModeCommand(bot: TelegramBot, chatId: number, text: string) {
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
}
