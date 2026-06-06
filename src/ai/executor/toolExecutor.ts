import chalk from 'chalk';
import { handleToolCall } from '../tools/systemTools';
import { getActiveMode, SENSITIVE_TOOLS, confirmToolCall } from '../../utils/modeManager';
import { markSelfHeal, markFileComplete } from '../../utils/stateManager';
import { log } from '../../utils/context';
import { truncateToolResult } from '../utils/messageFormatter';
import type { NormalizedContentBlock } from '../providers/types';

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
      const lp = String(JSON.stringify(block.input)).toLowerCase();
      if (
        lp.includes('.env') || lp.includes('secret') || lp.includes('key') ||
        lp.includes('.pem') || lp.includes('credentials') || lp.includes('token') ||
        lp.includes('password') || lp.includes('oauth')
      ) {
        logInputStr = '[MASKED SENSITIVE INFO]';
      }
    }

    logExecution(`TOOL_CALL: ${block.name} | Input: ${logInputStr}`);

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
      } else {
        state.commandHealCount = 0;
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
    } as any);
  }

  return { toolResultBlocks, hasCommandFailure, userAborted };
}
