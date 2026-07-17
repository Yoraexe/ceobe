// Module: src/ai/executor.ts
// Tujuan: Menjalankan agent loop berdasarkan rencana eksekusi menggunakan AI provider.
// Caller: src/index.ts, src/ai/supervisor.ts
// Dependensi: providers/router, providers/types, systemTools, stateManager, modeManager, chalk, ora, fs, path, costTracker, retry, plugins/pluginLoader, taskParser, messageFormatter

import { env } from '../config/env';
import { createExecutorAdapter } from './providers/router';
import type { NormalizedMessage, NormalizedTool, NormalizedContentBlock } from './providers/types';
import chalk from 'chalk';
import ora from 'ora';
import { tools as rawTools, activeBackgroundProcesses } from './tools/systemTools';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir, log } from '../utils/context';
import { recordUsage, checkBudget } from '../utils/costTracker';
import { withRetry } from '../utils/retry';
import { loadDynamicTools, clearLoadedPlugins } from './plugins/pluginLoader';
import { parseTaskWaves } from './taskParser';
import { 
  trimMessages, 
  getExecutorSystemInstruction, 
  truncateModelResponse, 
  cleanupOldSelfHeals 
} from './utils/messageFormatter';
import { executeToolCalls } from './executor/toolExecutor';

export { trimMessages }; // For backward compatibility with tests

const tools = rawTools as NormalizedTool[];

const MAX_SELF_HEAL = 3;

export async function executePlan(
  planMarkdown: string,
  selectedSkills: string[] = []
): Promise<void> {
  clearLoadedPlugins();
  const adapter = createExecutorAdapter();
  const spinner = ora(`${adapter.name.toUpperCase()} (${adapter.modelId}) is executing the plan...`).start();

  let jsonHealCount = 0;
  let commandHealCount = 0;
  let maxTokensRetries = 0;
  let consecutiveSuccesses = 0;

  try {
    const logPath = path.join(getProjectDir(), '.ceobe', 'execution.log');
    if (!fs.existsSync(path.dirname(logPath))) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    const logExecution = (text: string): void => {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`, 'utf8');
    };

    const dynamicTools = await loadDynamicTools(getProjectDir());
    const filteredDynamicTools = selectedSkills.length > 0 
      ? dynamicTools.filter(t => selectedSkills.includes(t.name) || selectedSkills.some(s => t.name.includes(s)))
      : dynamicTools;
    const finalTools = [...tools, ...filteredDynamicTools].sort((a, b) => a.name.localeCompare(b.name));

    logExecution(`--- STARTED EXECUTION (provider: ${adapter.name}, model: ${adapter.modelId}) ---`);

    const systemInstruction = getExecutorSystemInstruction();

    let messages: NormalizedMessage[] = [
      {
        role: 'user',
        content: `Execute the following plan:\n\n${planMarkdown}`,
      },
    ];

    let isThinking = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 50;

    while (isThinking) {
      iterationCount++;

      if (iterationCount > MAX_ITERATIONS) {
        throw new Error(`Max iterations (${MAX_ITERATIONS}) reached. Agent is stuck in an infinite loop. Execution aborted.`);
      }

      messages = trimMessages(messages, 25);

      const response = await withRetry(() => adapter.chat(messages, finalTools, systemInstruction));

      if (response.usage) {
        recordUsage({
          model: adapter.modelId,
          inputTokens: response.usage.input_tokens || 0,
          outputTokens: response.usage.output_tokens || 0,
        });
      }

      const textBlock = response.content.find((c) => c.type === 'text');
      if (textBlock?.text) {
        spinner.text = chalk.cyan(
          `[${adapter.name.toUpperCase()}] ${textBlock.text.substring(0, 70)}...`
        );
      }

      const toolCalls = response.content.filter((c) => c.type === 'tool_use');

      const filteredContent = truncateModelResponse(response.content, 4000);
      messages.push({ role: 'assistant', content: filteredContent });

      if (response.stop_reason === 'max_tokens') {
        consecutiveSuccesses = 0;
        maxTokensRetries++;
        if (maxTokensRetries > 3) {
          throw new Error('Model repeatedly hitting max_tokens limit. Context may be too large.');
        }
        if (toolCalls.length === 0) {
          logExecution('WARN: Hit max_tokens mid-text. Asking model to continue.');
          messages.push({
            role: 'user',
            content: 'You hit the max_tokens limit mid-response. Please continue exactly where you left off.',
          });
          continue;
        } else {
          logExecution('WARN: Hit max_tokens mid-tool-call. Discarding truncated response.');
          messages.pop();
          messages.push({
            role: 'user',
            content: 'You hit the max_tokens limit while generating tool calls. Your last response was discarded. Please retry, but use fewer tool calls per turn.',
          });
          continue;
        }
      } else {
        // Only reset if we are confident the model is not alternating between max_tokens and normal stops
        // By keeping a small buffer (decrementing instead of resetting to 0), we track sustained token bleeds.
        consecutiveSuccesses++;
        if (consecutiveSuccesses >= 2) {
          maxTokensRetries = 0;
        } else if (maxTokensRetries > 0) {
          maxTokensRetries--;
        }
      }

      if (toolCalls.length === 0) {
        messages.push({
          role: 'user',
          content: 'You did not call any tools. If you are done, you MUST call finish_task. Otherwise, continue working.',
        });
        continue;
      } else {
        const hasFinishTask = toolCalls.some(t => t.name === 'finish_task');

        const state = { jsonHealCount, commandHealCount };
        const result = await executeToolCalls(
          toolCalls,
          adapter.name,
          spinner,
          logExecution,
          state
        );
        jsonHealCount = state.jsonHealCount;
        commandHealCount = state.commandHealCount;

        if (result.userAborted) {
          return;
        }

        let { toolResultBlocks } = result;

        if (result.hasCommandFailure) {
          spinner.warn(
            chalk.yellow(`[Self-Heal ${commandHealCount}/${MAX_SELF_HEAL}] Command failed. Requesting AI bug-fix...`)
          );
          spinner.start();
          
          if (commandHealCount >= MAX_SELF_HEAL) {
            throw new Error(`[Self-Heal] Maximum autonomous repair cycles (${MAX_SELF_HEAL}) exceeded.`);
          }

          const healDirective = `\n\n[SELF-HEAL ${commandHealCount}/${MAX_SELF_HEAL}] Command FAILED. Fix the error above and retry.`;
          messages = cleanupOldSelfHeals(messages);

          const lastResult = toolResultBlocks[toolResultBlocks.length - 1];
          if (lastResult && lastResult.type === 'tool_result' && typeof lastResult.content === 'string') {
            lastResult.content += healDirective;
          }
        } else {
          commandHealCount = 0; // Fix H-08: Reset counter on successful command
        }
        
        if (hasFinishTask) {
           if (toolResultBlocks.length > 0) {
             spinner.warn(chalk.yellow(`[Warning] Model mixed finish_task with other tools. Forcing one more turn for verification.`));
             toolResultBlocks.push({
               type: 'text' as const,
               text: 'You called finish_task along with other tools. Here are the results of those tools. Please verify them. If everything is complete, call finish_task AGAIN by itself.'
             } as NormalizedContentBlock);
             const finishTaskTool = toolCalls.find(t => t.name === 'finish_task');
             if (finishTaskTool) {
               toolResultBlocks.push({
                 type: 'tool_result',
                 tool_use_id: finishTaskTool.id,
                 name: finishTaskTool.name,
                 content: 'Tool call ignored because it was mixed with other tools. Please verify the other tool results first.'
               } as NormalizedContentBlock);
             }
           } else {
             isThinking = false;
             spinner.succeed(chalk.green(`[${adapter.name.toUpperCase()}] (${adapter.modelId}) called finish_task. Execution complete.`));
             log(chalk.cyan('\n--- Final Response ---\n'));
             if (textBlock?.text) log(textBlock.text);
             log(chalk.cyan('\n----------------------\n'));
             
             const finishTaskTool = toolCalls.find(t => t.name === 'finish_task');
             if (finishTaskTool) {
               messages.push({
                 role: 'user',
                 content: [{
                   type: 'tool_result',
                   tool_use_id: finishTaskTool.id,
                   name: finishTaskTool.name,
                   content: 'Task marked as finished successfully.'
                 }] as NormalizedContentBlock[]
               });
             }
           }
        }

        if (toolResultBlocks.length > 0) {
          messages.push({ role: 'user', content: toolResultBlocks });
        }
      }
      
      checkBudget(env.CEOBE_MAX_BUDGET);
    }

    logExecution('--- FINISHED EXECUTION ---\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(
      chalk.red(`[${adapter.name.toUpperCase()}] Execution failed: ${msg}`)
    );
    const logPath = path.join(getProjectDir(), '.ceobe', 'execution.log');
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] ERROR: ${msg}\n`,
      'utf8'
    );
    throw error;
  } finally {
    for (const [id, child] of activeBackgroundProcesses.entries()) {
      child.kill('SIGKILL');
      activeBackgroundProcesses.delete(id);
    }
  }
}

export async function executeWaves(planMarkdown: string, selectedSkills: string[] = [], execFeedback: string = ''): Promise<void> {
  const finalTask = planMarkdown;
  const waves = parseTaskWaves(finalTask);
  const totalTasks = waves.reduce((sum, w) => sum + w.tasks.length, 0);

  if (waves.length > 1) {
    log(chalk.cyan(`\n[Parallel Executor] Plan dipecah menjadi ${waves.length} gelombang eksekusi.`));
    log(chalk.dim(`  Total task: ${totalTasks} | Paralel per gelombang: max ${Math.max(...waves.map(w => w.tasks.length))}\n`));
  }

  for (const wave of waves) {
    if (wave.tasks.length > 1) {
      log(chalk.magenta(`\n[Parallel Executor] Gelombang ${wave.wave} — ${wave.tasks.length} task berjalan paralel...`));
      const waveResults = await Promise.allSettled(
        wave.tasks.map(waveTask =>
          executePlan(
            waveTask.content + (execFeedback ? `\n\n[URGENT: FIX THESE ERRORS FROM PREVIOUS RUN]\n${execFeedback}` : ''),
            selectedSkills
          )
        )
      );
      const failures = waveResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length > 0) {
        failures.forEach(f => {
          const msg = f.reason ? String(f.reason) : '';
          log(chalk.red(`  [Wave ${wave.wave}] Task gagal: ${msg.substring(0, 120)}`));
        });
        throw new Error(`Wave ${wave.wave} execution failed. Aborting pipeline.`);
      } else {
        log(chalk.green(`  [Wave ${wave.wave}] Semua task selesai.`));
      }
    } else if (wave.tasks.length === 1) {
      log(chalk.blue(`\n[Parallel Executor] Gelombang ${wave.wave} — 1 task (sequential).`));
      await executePlan(wave.tasks[0].content + (execFeedback ? `\n\n[FIX ERRORS]\n${execFeedback}` : ''), selectedSkills);
    }
  }
}
