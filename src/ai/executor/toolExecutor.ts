import chalk from 'chalk';
import { handleToolCall } from '../tools/systemTools';
import { getActiveMode, SENSITIVE_TOOLS, confirmToolCall } from '../../utils/modeManager';
import { markSelfHeal, markFileComplete, readPentestState } from '../../utils/stateManager';
import { log } from '../../utils/context';
import { truncateToolResult } from '../utils/messageFormatter';
import type { NormalizedContentBlock } from '../providers/types';
import { enforceTalosGuard } from '../pentest/talosGuard';
import { checkToolInstalled, installTool } from '../pentest/toolsCatalog';
import { askUserConfirmation } from '../utils/loopHandlers';

function isCommandFailure(result: unknown): boolean {
  if (typeof result !== 'string') return false;
  return result.trimStart().startsWith('Command failed:');
}

export interface ToolExecutionState {
  jsonHealCount: number;
  commandHealCount: number;
}

export interface ToolExecutionResult {
  toolResultBlocks: NormalizedContentBlock[];
  hasCommandFailure: boolean;
  userAborted: boolean;
}

export async function executeToolCalls(
  blocks: any[],
  adapterName: string,
  spinner: any,
  logExecution: (msg: string) => void,
  state: ToolExecutionState
): Promise<ToolExecutionResult> {
  const toolResultBlocks: NormalizedContentBlock[] = [];
  const activeMode = getActiveMode();
  let hasCommandFailure = false;
  let userAborted = false;

  const realTools = blocks.filter(t => t.type === 'tool_use' && t.name !== 'finish_task');

  for (const block of realTools) {
    if (!block.name) continue;

    spinner.text = chalk.yellow(`[${adapterName.toUpperCase()}] Executing tool: ${block.name}...`);

    if (activeMode === 'ask' && SENSITIVE_TOOLS.has(block.name)) {
      spinner.stop();
      let approved = false;
      try {
        approved = await confirmToolCall(block.name, (block.input ?? {}) as Record<string, unknown>);
      } catch (abortErr: unknown) {
        const msg = abortErr instanceof Error ? abortErr.message : String(abortErr);
        log(chalk.red(`\n[Mode: Bertanya] ${msg}`));
        logExecution(`USER_ABORT: Session terminated by user during ${block.name}`);
        return { toolResultBlocks, hasCommandFailure: false, userAborted: true };
      }

      if (!approved) {
        log(chalk.gray(`  ↳ Dilewati oleh pengguna.\n`));
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          name: block.name,
          content: `SKIPPED: User chose to skip this action.`,
        });
        spinner.start();
        continue;
      }
      spinner.start();
    }

    let logInputStr = JSON.stringify(block.input);
    if (block.input) {
      const lp = logInputStr;
      const lower = lp.toLowerCase();
      // Fix M-14: Regex for actual API keys & tokens
      const hasKeyKeywords = lower.includes('.env') || lower.includes('secret') || lower.includes('key') ||
                             lower.includes('.pem') || lower.includes('credentials') || lower.includes('token') ||
                             lower.includes('password') || lower.includes('oauth');
      
      const hasActualSecrets = /sk-[a-zA-Z0-9]{20,}/.test(lp) || /Bearer\s+[a-zA-Z0-9\-\._~+\/]+=*/i.test(lp) || /(AIza[0-9A-Za-z\-_]{35})/i.test(lp);

      if (hasKeyKeywords || hasActualSecrets) {
        logInputStr = '[MASKED SENSITIVE INFO]';
      }
    }

    logExecution(`TOOL_CALL: ${block.name} | Input: ${logInputStr}`);

    // Check Talos Guard and Tools Catalog before execution if running in pentest context
    const pentestState = await readPentestState();
    if (pentestState && pentestState.scopePath) {
      // 1. Enforce program scope safety (Talos Guard)
      if (block.name === 'execute_command' && block.input?.command) {
        enforceTalosGuard(String(block.input.command), pentestState.scopePath);
      } else if (block.name === 'visual_audit' && block.input?.url_or_path) {
        enforceTalosGuard(String(block.input.url_or_path), pentestState.scopePath);
      } else if (block.name === 'reverse_engineer' && block.input?.url) {
        enforceTalosGuard(String(block.input.url), pentestState.scopePath);
      }

      // 2. Warn/verify tool catalog installation state
      const targetTool = block.name === 'execute_command' 
        ? String(block.input?.command || '').split(' ')[0] 
        : block.name;
      
      // Verification for common pentest tools (excluding general system files)
      if (block.name === 'execute_command' && targetTool && !['cd', 'echo', 'mkdir', 'rm', 'ls', 'dir', 'where', 'which', 'git', 'npm', 'node', 'tsc', 'go'].includes(targetTool)) {
        if (!checkToolInstalled(targetTool)) {
          spinner.stop();
          log(chalk.yellow(`\n[Tool Catalog] Tool '${targetTool}' is not installed.`));
          const installApproved = await askUserConfirmation(`Do you want Ceobe to install '${targetTool}' automatically?`);
          
          if (installApproved) {
            spinner.start(chalk.cyan(`Installing '${targetTool}'...`));
            const installRes = await installTool(targetTool);
            if (installRes.success) {
              spinner.succeed(chalk.green(`Successfully installed '${targetTool}'!`));
            } else {
              spinner.warn(chalk.red(`Failed to install '${targetTool}': ${installRes.message}`));
            }
          } else {
            log(chalk.gray(`Skipping installation of '${targetTool}'. Execution might fail.`));
          }
          spinner.start();
        }
      }
    }

    let resultPayload: unknown;
    if (block.input && typeof block.input === 'object' && '_error' in block.input) {
      resultPayload = `Error: Model generated malformed JSON for tool arguments. ${block.input._error || 'Invalid syntax'}. Raw input: ${block.input.raw}`;
      state.jsonHealCount++;
      await markSelfHeal();
      logExecution(`SELF_HEAL_JSON[${state.jsonHealCount}]: Malformed JSON detected in tool '${block.name}'.`);
    } else {
      resultPayload = await handleToolCall(block.name, block.input ?? {});
      state.jsonHealCount = 0; // Reset JSON heal on a successful tool parse
    }
    
    let resultBlocks = truncateToolResult(resultPayload, 8000);
    const resultStr = typeof resultBlocks === 'string' ? resultBlocks : JSON.stringify(resultBlocks);

    if (block.name === 'execute_command') {
      if (isCommandFailure(resultStr)) {
        hasCommandFailure = true;
        state.commandHealCount++;
        await markSelfHeal();
        logExecution(`SELF_HEAL_CMD[${state.commandHealCount}]: Command failure detected in tool '${block.name}'.`);
      }
    }

    logExecution(
      `TOOL_RESULT: ${resultStr.substring(0, 200)}${resultStr.length > 200 ? '...' : ''}`
    );

    if (
      (block.name === 'write_file' || block.name === 'edit_file') &&
      block.input?.file_path
    ) {
      await markFileComplete(String(block.input.file_path));
    }

    toolResultBlocks.push({
      type: 'tool_result',
      tool_use_id: block.id,
      name: block.name,
      content: resultBlocks,
    } as NormalizedContentBlock);
  }

  return { toolResultBlocks, hasCommandFailure, userAborted };
}
