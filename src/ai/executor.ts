// Module: src/ai/executor.ts
// Purpose: Execution Engine. Runs the agent loop using any configured AI provider.
//          Provider selection is handled by createExecutorAdapter() - not here.
//          When mode=ask, destructive tool calls pause and require user confirmation.
//          v1.7.0: Self-Healing — when execute_command fails, the executor injects a
//          "FIX THIS ERROR" directive and retries autonomously up to MAX_SELF_HEAL times.
// Caller: src/index.ts, src/ai/supervisor.ts
// Dependencies: providers/router, providers/types, systemTools, stateManager, modeManager, chalk, ora, fs, path
// Side Effects: Sends HTTP requests to the configured AI provider, calls system tools (I/O).
// Main Functions: executePlan, trimMessages

import { createExecutorAdapter } from './providers/router';
import type { NormalizedMessage, NormalizedContentBlock, NormalizedTool } from './providers/types';
import chalk from 'chalk';
import ora from 'ora';
import { tools as rawTools, handleToolCall } from './tools/systemTools';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { markFileComplete, markSelfHeal } from '../utils/stateManager';
import { getActiveMode, SENSITIVE_TOOLS, confirmToolCall } from '../utils/modeManager';
import { recordUsage, checkBudget } from '../utils/costTracker';
import { loadDynamicTools } from './plugins/pluginLoader';

// Cast Ceobe's internal tool format to the normalized type
const tools = rawTools as unknown as NormalizedTool[];

// ── Self-Healing constants ────────────────────────────────────────────────────
/** Maximum number of autonomous bug-fix cycles before giving up. */
const MAX_SELF_HEAL = 3;

/**
 * Returns true when an execute_command tool result signals a failure.
 * Matches the format returned by systemTools.ts execute_command handler.
 */
function isCommandFailure(result: unknown): boolean {
  if (typeof result !== 'string') return false;
  return result.trimStart().startsWith('Command failed:');
}

/**
 * Safely trims the message history to avoid exceeding context window limits,
 * while ensuring tool_use / tool_result pairs are never orphaned.
 */
export function trimMessages(
  messages: NormalizedMessage[],
  maxMessages: number = 25
): NormalizedMessage[] {
  if (messages.length <= maxMessages) return messages;

  const firstMessage = messages[0];
  const targetTailLength = maxMessages - 1;
  let sliceIndex = messages.length - targetTailLength;

  // Ensure we never start on a user message that is a tool_result without its
  // preceding assistant tool_use.
  while (sliceIndex > 1) {
    const startMsg = messages[sliceIndex];
    let startsWithToolResult = false;

    if (startMsg.role === 'user' && Array.isArray(startMsg.content)) {
      startsWithToolResult = startMsg.content.some(
        (c: NormalizedContentBlock) => c.type === 'tool_result'
      );
    }

    if (startsWithToolResult) {
      sliceIndex--;
    } else {
      break;
    }
  }

  return [firstMessage, ...messages.slice(sliceIndex)];
}

export async function executePlan(
  planMarkdown: string,
  architecture: string = '',
  design: string = ''
): Promise<void> {
  const adapter = createExecutorAdapter();
  const spinner = ora(`${adapter.name.toUpperCase()} (${adapter.modelId}) is executing the plan...`).start();

  /** Tracks how many self-healing cycles have been used in this executePlan call. */
  let selfHealCount = 0;

  try {
    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    if (!fs.existsSync(path.dirname(logPath))) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    const logExecution = (text: string): void => {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`, 'utf8');
    };

    const dynamicTools = await loadDynamicTools(env.TARGET_PROJECT_DIR);
    const finalTools = [...tools, ...dynamicTools];

    logExecution(`--- STARTED EXECUTION (provider: ${adapter.name}, model: ${adapter.modelId}) ---`);

    let systemInstruction = `
You are the Execution Engine of the Ceobe AI System.
Your task is to take the provided execution plan and strictly implement it.
You have access to tool commands to read/write files and run terminal commands.
DO NOT provide planning commentary. DO NOT hallucinate dependencies. Write code.
`;

    if (architecture) {
      systemInstruction += `\n[ARCHITECTURE CONTEXT]\nAdhere to the following architecture strictly:\n${architecture}\n`;
    }
    if (design) {
      systemInstruction += `\n[DESIGN CONTEXT]\nAdhere to the following design constraints:\n${design}\n`;
    }

    let messages: NormalizedMessage[] = [
      {
        role: 'user',
        content: `Execute the following plan:\n\n${planMarkdown}`,
      },
    ];

    let isThinking = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 50; // Guard against infinite failure loops

    while (isThinking) {
      iterationCount++;
      if (iterationCount > MAX_ITERATIONS) {
        throw new Error(`Max iterations (${MAX_ITERATIONS}) reached. Agent is stuck in an infinite loop. Execution aborted.`);
      }

      messages = trimMessages(messages, 25);

      const response = await adapter.chat(messages, finalTools, systemInstruction);

      // Record usage for budget tracking
      if (response.usage) {
        recordUsage({
          model: adapter.modelId,
          inputTokens: response.usage.input_tokens || 0,
          outputTokens: response.usage.output_tokens || 0,
        });
      }

      // Surface the model's text reasoning in the spinner
      const textBlock = response.content.find((c) => c.type === 'text');
      if (textBlock?.text) {
        spinner.text = chalk.cyan(
          `[${adapter.name.toUpperCase()}] ${textBlock.text.substring(0, 70)}...`
        );
      }

      const toolCalls = response.content.filter((c) => c.type === 'tool_use');

      // Append the assistant's full response to history
      messages.push({ role: 'assistant', content: response.content });

      // --- Token truncation recovery ---
      if (response.stop_reason === 'max_tokens') {
        if (toolCalls.length === 0) {
          logExecution('WARN: Hit max_tokens mid-text. Asking model to continue.');
          messages.push({
            role: 'user',
            content:
              'You hit the max_tokens limit mid-response. Please continue exactly where you left off.',
          });
          continue;
        } else {
          logExecution('WARN: Hit max_tokens mid-tool-call. Discarding truncated response.');
          messages.pop();
          messages.push({
            role: 'user',
            content:
              'You hit the max_tokens limit while generating tool calls. Your last response was discarded. Please retry, but use fewer tool calls per turn.',
          });
          continue;
        }
      }

      // --- Agentic loop stop condition ---
      if (toolCalls.length === 0) {
        isThinking = false;
        spinner.succeed(
          chalk.green(`[${adapter.name.toUpperCase()}] (${adapter.modelId}) execution complete.`)
        );
        console.log(chalk.cyan('\n--- Final Response ---\n'));
        if (textBlock?.text) console.log(textBlock.text);
        console.log(chalk.cyan('\n----------------------\n'));
      } else {
        // --- Execute tool calls and feed results back ---
        const toolResultBlocks: NormalizedContentBlock[] = [];
        const activeMode = getActiveMode();

        for (const block of toolCalls) {
          if (block.type !== 'tool_use' || !block.name) continue;

          spinner.text = chalk.yellow(`[${adapter.name.toUpperCase()}] Executing tool: ${block.name}...`);

          // ── ASK MODE GATE ──────────────────────────────────────────
          if (activeMode === 'ask' && SENSITIVE_TOOLS.has(block.name)) {
            spinner.stop();
            let approved = false;
            try {
              approved = await confirmToolCall(block.name, (block.input ?? {}) as Record<string, unknown>);
            } catch (abortErr: unknown) {
              // User typed 'a' / 'abort' — stop the entire session
              const msg = abortErr instanceof Error ? abortErr.message : String(abortErr);
              console.log(chalk.red(`\n[Mode: Bertanya] ${msg}`));
              logExecution(`USER_ABORT: Session terminated by user during ${block.name}`);
              return;
            }

            if (!approved) {
              console.log(chalk.gray(`  ↳ Dilewati oleh pengguna.\n`));
              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: `SKIPPED: User chose to skip this action.`,
              });
              spinner.start();
              continue;
            }
            spinner.start();
          }
          // ───────────────────────────────────────────────────────────

          // Security: mask secrets from execution log
          let logInputStr = JSON.stringify(block.input);
          if (
            (block.name === 'write_file' || block.name === 'edit_file') &&
            block.input?.file_path
          ) {
            const lp = String(block.input.file_path).toLowerCase();
            if (
              lp.includes('.env') ||
              lp.includes('secret') ||
              lp.includes('key') ||
              lp.includes('.pem')
            ) {
              logInputStr = JSON.stringify({
                ...block.input,
                content: '[MASKED]',
                replacement_content: '[MASKED]',
              });
            }
          }

          logExecution(`TOOL_CALL: ${block.name} | Input: ${logInputStr}`);

          const resultPayload = await handleToolCall(block.name, block.input ?? {});
          
          // Support multimodal results (arrays of content blocks)
          let resultBlocks: any;
          if (Array.isArray(resultPayload)) {
            resultBlocks = resultPayload;
          } else {
            resultBlocks = typeof resultPayload === 'string'
              ? resultPayload
              : JSON.stringify(resultPayload);
          }

          const resultStr = typeof resultBlocks === 'string' ? resultBlocks : JSON.stringify(resultBlocks);

          // ── SELF-HEALING GATE ───────────────────────────────────────────────
          // When execute_command returns a failure, annotate the result so the
          // LLM understands it MUST fix the code — not just acknowledge the error.
          if (block.name === 'execute_command' && isCommandFailure(resultStr)) {
            selfHealCount++;
            markSelfHeal(); // Persist cycle count to .ceobe/ceobe-state.json
            spinner.warn(
              chalk.yellow(`[Self-Heal ${selfHealCount}/${MAX_SELF_HEAL}] Command failed. Requesting AI bug-fix...`)
            );
            spinner.start();
            logExecution(`SELF_HEAL[${selfHealCount}/${MAX_SELF_HEAL}]: Command failure detected in tool '${block.name}'.`);

            if (selfHealCount > MAX_SELF_HEAL) {
              throw new Error(
                `[Self-Heal] Maximum autonomous repair cycles (${MAX_SELF_HEAL}) exceeded.\n` +
                `Last failure output:\n${resultStr.substring(0, 1000)}`
              );
            }

            // Augment the tool result with a mandatory fix directive.
            const healDirective =
              `\n\n⚠️  [SELF-HEAL DIRECTIVE — Cycle ${selfHealCount}/${MAX_SELF_HEAL}]\n` +
              `The command above FAILED. You MUST:\n` +
              `1. Read the error output carefully.\n` +
              `2. Identify the root cause (syntax error, missing import, wrong path, etc.).\n` +
              `3. Fix the offending file(s) using write_file or edit_file.\n` +
              `4. Re-run the failed command to verify the fix.\n` +
              `DO NOT skip this. DO NOT proceed to the next task until this command succeeds.`;

            resultBlocks = resultStr + healDirective;
          }
          // ───────────────────────────────────────────────────────────────────

          logExecution(
            `TOOL_RESULT: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`
          );

          // Mark file as complete for state resume
          if (
            (block.name === 'write_file' || block.name === 'edit_file') &&
            block.input?.file_path
          ) {
            markFileComplete(String(block.input.file_path));
          }

          toolResultBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultBlocks,
          });
        }

        messages.push({ role: 'user', content: toolResultBlocks });
      }
      
      // Enforce Budget Limit (if set)
      checkBudget(env.CEOBE_MAX_BUDGET);
    }

    logExecution('--- FINISHED EXECUTION ---\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(
      chalk.red(`[${adapter.name.toUpperCase()}] Execution failed: ${msg}`)
    );
    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] ERROR: ${msg}\n`,
      'utf8'
    );
    throw error;
  }
}
