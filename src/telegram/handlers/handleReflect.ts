import TelegramBot from 'node-telegram-bot-api';
import { analyzeExecutionLog } from '../../ai/reflectiveAnalyzer';
import { getActiveSession } from '../sessionManager';

export async function handleReflectCommand(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
  const chatId = msg.chat.id;
  const session = getActiveSession(chatId);
  if (!session) {
    bot.sendMessage(chatId, '❌ Sesi tidak ditemukan. Gunakan /start atau /cd.');
    return;
  }
  
  const text = msg.text || '';
  const autoSkill = text.includes('auto-skill');
  
  bot.sendMessage(chatId, '🔍 Menganalisis execution.log...');
  
  try {
    const report = await analyzeExecutionLog(autoSkill);
    if (!report) {
      bot.sendMessage(chatId, '❌ Gagal melakukan refleksi atau log kosong.');
      return;
    }
    
    let reply = `✅ **Reflection Report (Score: ${report.efficiencyScore}/100)**\n`;
    reply += `*Periode:* ${report.period.from} - ${report.period.to}\n\n`;
    
    if (report.patterns.length > 0) {
      reply += `⚠️ *Inefficiency Patterns:*\n`;
      report.patterns.forEach(p => reply += `- ${p}\n`);
      reply += `\n`;
    }
    
    if (report.suggestedSkills.length > 0) {
      reply += `💡 *Suggested Skills:*\n`;
      report.suggestedSkills.forEach(s => reply += `- ${s}\n`);
      reply += `\n`;
    }
    
    if (autoSkill && report.suggestedSkills.length > 0) {
      reply += `✅ *Auto-Skill:* Draft untuk '${report.suggestedSkills[0]}' berhasil dibuat!`;
    }
    
    bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  } catch (e: unknown) {
    const msgErr = e instanceof Error ? e.message : String(e);
    bot.sendMessage(chatId, `❌ Reflection failed: ${msgErr}`);
  }
}
