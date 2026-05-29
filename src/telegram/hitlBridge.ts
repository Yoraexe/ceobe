// Tujuan: Meneruskan permintaan konfirmasi (Human-in-the-Loop) dari executor ke Telegram menggunakan tombol interaktif (Inline Keyboard).
// Caller: src/telegram/telegramDaemon.ts
// Dependensi: node-telegram-bot-api, modeManager, crypto
// Main Functions: TelegramHITLBridge
// Side Effects: Mengirim pesan Telegram, mendengarkan callback query, mengedit markup pesan Telegram
// v1.8.0: Fase 1 - Telegram HITL Interaktif

import TelegramBot from 'node-telegram-bot-api';
import { ConfirmationBridge } from '../utils/modeManager';
import { randomUUID } from 'crypto';

export class TelegramHITLBridge implements ConfirmationBridge {
  private bot: TelegramBot;
  private chatId: number;
  private timeoutMs: number;

  constructor(bot: TelegramBot, chatId: number, timeoutMs = 120000) {
    this.bot = bot;
    this.chatId = chatId;
    this.timeoutMs = timeoutMs;
  }

  public async requestConfirmation(summary: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Buat UUID unik untuk sesi konfirmasi ini agar tidak tertukar dengan tombol lama
      const actionId = randomUUID().substring(0, 8);
      const cbYes = `hitl_yes_${actionId}`;
      const cbNo = `hitl_no_${actionId}`;
      const cbAbort = `hitl_abort_${actionId}`;

      const options: TelegramBot.SendMessageOptions = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Izinkan', callback_data: cbYes },
              { text: '⏭️ Lewati', callback_data: cbNo }
            ],
            [
              { text: '🛑 Batalkan Pipeline', callback_data: cbAbort }
            ]
          ]
        }
      };

      const messageText = `⚠️ *KONFIRMASI DIPERLUKAN*\n\nCeobe akan melakukan aksi berikut:\n\`\`\`\n${summary}\n\`\`\`\n\n_Pilih aksi dalam ${this.timeoutMs / 1000} detik:_`;

      let timeoutHandle: NodeJS.Timeout | undefined;
      let listener: (query: TelegramBot.CallbackQuery) => void;
      let sentMessageId: number | undefined;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.bot.removeListener('callback_query', listener);
        // Hapus tombol setelah dijawab/timeout
        if (sentMessageId) {
          this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: this.chatId, message_id: sentMessageId }).catch(() => {});
        }
      };

      // 1. Kirim pesan ke Telegram
      this.bot.sendMessage(this.chatId, messageText, options).then((msg) => {
        sentMessageId = msg.message_id;
        
        // 2. Set timeout (auto abort jika tidak ada respons)
        timeoutHandle = setTimeout(() => {
          cleanup();
          reject(new Error('TIMEOUT: Tidak ada respons konfirmasi dari Telegram selama 120 detik. Sesi dibatalkan demi keamanan.'));
        }, this.timeoutMs);

        // 3. Dengarkan jawaban tombol
        listener = (query: TelegramBot.CallbackQuery) => {
          if (!query.data || query.message?.chat.id !== this.chatId) return;

          if (query.data === cbYes || query.data === cbNo || query.data === cbAbort) {
            cleanup();
            
            let responseText = '';
            if (query.data === cbYes) responseText = '✅ Aksi diizinkan.';
            if (query.data === cbNo) responseText = '⏭️ Aksi dilewati.';
            if (query.data === cbAbort) responseText = '🛑 Pipeline dibatalkan.';

            // Beri feedback ke user di Telegram
            this.bot.answerCallbackQuery(query.id, { text: responseText });
            
            if (sentMessageId) {
               this.bot.editMessageText(`⚠️ *KONFIRMASI SELESAI*\n\nAksi:\n\`\`\`\n${summary}\n\`\`\`\n\nKeputusan: ${responseText}`, {
                 chat_id: this.chatId,
                 message_id: sentMessageId,
                 parse_mode: 'Markdown'
               }).catch(() => {});
            }

            if (query.data === cbYes) resolve(true);
            else if (query.data === cbNo) resolve(false);
            else reject(new Error('USER_ABORT: Sesi dihentikan oleh pengguna via Telegram.'));
          }
        };

        this.bot.on('callback_query', listener);
      }).catch((err) => {
        reject(new Error(`Gagal mengirim konfirmasi HITL ke Telegram: ${err.message}`));
      });
    });
  }
}
