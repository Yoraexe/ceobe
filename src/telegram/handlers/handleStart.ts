import TelegramBot from 'node-telegram-bot-api';

export async function handleStartCommand(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(
    chatId,
    '👋 Halo! Saya *Ceobe*, AI Engineering Orchestrator Anda.\n\nKirimkan saya deskripsi proyek atau fitur yang ingin Anda bangun, dan saya akan mengerjakannya secara otomatis! 🚀',
    { parse_mode: 'Markdown' }
  );
}

export async function handleHelpCommand(bot: TelegramBot, chatId: number) {
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
}
