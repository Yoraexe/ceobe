import TelegramBot from 'node-telegram-bot-api';
import { getActiveSession } from '../sessionManager';
import { readAllKeys, getRequiredKeyForActiveProviders, KEY_DEFINITIONS } from '../../utils/keyManager';
import { execFile } from 'child_process';

export async function handleDoctorCommand(bot: TelegramBot, chatId: number) {
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
    // Fix L-03: Use execFile instead of exec to avoid shell injection
    const checkDep = (name: string, binary: string, args: string[]) => new Promise<string>((res) => {
      execFile(binary, args, (err: any, stdout: string) => {
        if (err) res(`  ✗ ${name}: Not found\n`);
        else res(`  ✓ ${name}: Available (${stdout.trim()})\n`);
      });
    });
    output += await checkDep('Node.js', 'node', ['-v']);
    output += await checkDep('npm', 'npm', ['-v']);
    output += await checkDep('Docker', 'docker', ['-v']);
    output += await checkDep('Git', 'git', ['--version']);
    
    await bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
  } catch (e: any) {
    await bot.sendMessage(chatId, `❌ Gagal menjalankan diagnostic: ${e.message}`);
  }
}
