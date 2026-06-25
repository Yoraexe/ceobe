import TelegramBot from 'node-telegram-bot-api';
import { setWorktreeMode, getWorktreeMode } from '../../utils/modeManager';

export async function handleWorktreeCommand(bot: TelegramBot, chatId: number, text: string): Promise<void> {
  const parts = text.split(' ');
  const cmd = parts[1]?.toLowerCase();

  if (cmd === 'on') {
    setWorktreeMode(true);
    await bot.sendMessage(chatId, '✅ Mode Git Worktree diaktifkan. Setiap task baru akan dijalankan di branch terisolasi.');
  } else if (cmd === 'off') {
    setWorktreeMode(false);
    await bot.sendMessage(chatId, '❌ Mode Git Worktree dinonaktifkan. Task akan dijalankan langsung di direktori aktif.');
  } else {
    const current = getWorktreeMode();
    await bot.sendMessage(
      chatId,
      `ℹ️ Status Worktree: *${current ? 'ON' : 'OFF'}*\n\n` +
      `Gunakan perintah:\n` +
      `/worktree on - Mengaktifkan isolasi branch untuk setiap task\n` +
      `/worktree off - Menonaktifkan isolasi branch`,
      { parse_mode: 'Markdown' }
    );
  }
}
