// Tujuan: Mengeksekusi plan dari model Anthropic dengan menangani pemanggilan tools secara asinkron.
// Caller: src/index.ts atau src/ai/planner.ts
// Dependensi: @anthropic-ai/sdk, systemTools, stateManager, retry
// Main Functions: executePlan
// Side Effects: Mengirim HTTP request ke Anthropic, memanggil fungsi sistem (I/O) via systemTools.

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { getGatewayUrl } from './gateway';
import chalk from 'chalk';
import ora from 'ora';
import { tools, handleToolCall } from './tools/systemTools';
import { withRetry } from '../utils/retry';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Safely trims Anthropic messages to avoid exceeding context window limits,
 * while ensuring that tool_use and tool_result blocks are never orphaned.
 */
export function trimMessages(messages: Anthropic.MessageParam[], maxMessages: number = 25): Anthropic.MessageParam[] {
  if (messages.length <= maxMessages) return messages;

  // Always keep the first message (usually the initial system or user prompt)
  const firstMessage = messages[0];
  const targetTailLength = maxMessages - 1;
  
  let sliceIndex = messages.length - targetTailLength;
  
  // We must ensure that the message at sliceIndex does not break a tool pair.
  // In Anthropic, a tool_result in role 'user' must be preceded by a tool_use in role 'assistant'.
  // If the first message in our tail is a user message containing 'tool_result',
  // we must move sliceIndex backwards to include the assistant message that spawned it.
  while (sliceIndex > 1) {
    const startMsg = messages[sliceIndex];
    
    // Check if startMsg is a user message containing tool_result
    let startsWithToolResult = false;
    if (startMsg.role === 'user' && Array.isArray(startMsg.content)) {
      startsWithToolResult = startMsg.content.some((c: any) => c.type === 'tool_result');
    }
    
    if (startsWithToolResult) {
       // Move index back by 1 to grab the assistant's tool_use
       sliceIndex--;
    } else {
       // Also check if we just split an assistant's tool_use from its user's tool_result.
       // i.e., if startMsg is an assistant message, we need to check if the PREVIOUS message
       // was ALSO an assistant message with tool calls, meaning we might be entering mid-chain.
       // The simplest invariant: if startMsg is 'assistant', it's safe to start there unless
       // it's a tool_use and the NEXT message is a user tool_result, which is fine since we keep the tail.
       break;
    }
  }
  
  return [firstMessage, ...messages.slice(sliceIndex)];
}

export async function executePlan(planMarkdown: string, architecture: string = '', design: string = ''): Promise<void> {
  const spinner = ora('Claude 4.6 Sonnet is executing the plan...').start();
  
  try {
    const gatewayUrl = getGatewayUrl('anthropic');
    const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: gatewayUrl
    });

    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const logExecution = (text: string) => {
       fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${text}\n`, 'utf8');
    };
    
    logExecution('--- STARTED EXECUTION ---');

    let systemInstruction = `
You are the Execution Engine of the Ceobe AI System.
Your task is to take the provided execution plan and strictly implement it.
You have access to tool commands if run within an agent wrapper, otherwise output the exact code and terminal commands required to fulfill the user's request.
DO NOT provide planning commentary. DO NOT hallucinate dependencies. Write code.
`;

    if (architecture) {
      systemInstruction += `\n[ARCHITECTURE CONTEXT]\nAdhere to the following architecture and folder structure strictly:\n${architecture}\n`;
    }
    
    if (design) {
      systemInstruction += `\n[DESIGN CONTEXT]\nAdhere to the following design constraints:\n${design}\n`;
    }

    let messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Execute the following plan:\n\n${planMarkdown}`
      }
    ];

    let isThinking = true;
    while (isThinking) {
      // Context Window Compression (Token Bloat Mitigation)
      messages = trimMessages(messages, 25);

      const msg = await withRetry(() => anthropic.messages.create({
        model: "claude-4.6-sonnet",
        max_tokens: 8192,
        temperature: 0,
        system: systemInstruction,
        messages: messages,
        tools: tools as any // Type bypass for SDK version compatibility,
      }));

      // Log the assistant's text reasoning before the tool call
      const textBlock = msg.content.find(c => c.type === 'text');
      if (textBlock && textBlock.type === 'text' && textBlock.text) {
         spinner.text = chalk.cyan(`Claude is thinking: ${textBlock.text.substring(0, 50)}...`);
      }

      const toolCalls = msg.content.filter(c => c.type === 'tool_use');
      
      messages.push({
        role: "assistant",
        content: msg.content
      });
      
      // Token Truncation Recovery
      if (msg.stop_reason === 'max_tokens') {
        if (toolCalls.length === 0) {
          // Case 1: Pure text truncation — ask Claude to continue
          logExecution('WARN: Hit max_tokens limit mid-text. Prompting to continue.');
          messages.push({
             role: 'user',
             content: 'You hit the max_tokens limit in the middle of your previous response. Please continue exactly where you left off. Do not repeat what you already said.'
          });
          continue;
        } else {
          // Case 2: Partial tool_use truncation — the last tool call's JSON may be incomplete.
          // Discard the truncated assistant message and ask Claude to retry with smaller steps.
          logExecution('WARN: Hit max_tokens limit mid-tool-call. Discarding truncated response and requesting retry.');
          messages.pop(); // Remove the potentially malformed assistant message we just pushed
          messages.push({
             role: 'user',
             content: 'You hit the max_tokens limit while generating tool calls. Your last response was discarded because it was incomplete. Please retry, but break your work into smaller steps — execute fewer tool calls per response to stay within the token limit.'
          });
          continue;
        }
      }

      if (toolCalls.length === 0) {
        // No more tools, stop loop
        isThinking = false;
        spinner.succeed(chalk.green('Claude 4.6 Sonnet execution completed.'));
        console.log(chalk.cyan('\n--- Final Response ---\n'));
        if (textBlock && textBlock.type === 'text') console.log(textBlock.text);
        console.log(chalk.cyan('\n----------------------\n'));
      } else {
        // Execute tool calls and feed results back to Claude
        let toolResults: Anthropic.ToolResultBlockParam[] = [];
        
        for (const block of toolCalls) {
          if (block.type !== 'tool_use') continue;
          
          spinner.text = chalk.yellow(`Claude is executing tool: ${block.name}...`);
          
          let logInputStr = JSON.stringify(block.input);
          if ((block.name === 'write_file' || block.name === 'edit_file') && block.input) {
             const inputObj = block.input as any;
             if (inputObj.file_path) {
                const lowerPath = String(inputObj.file_path).toLowerCase();
                if (lowerPath.includes('.env') || lowerPath.includes('secret') || lowerPath.includes('key') || lowerPath.includes('.pem')) {
                   const maskedInput = { ...inputObj, content: '[MASKED FOR SECURITY]', replacement_content: '[MASKED FOR SECURITY]' };
                   logInputStr = JSON.stringify(maskedInput);
                }
             }
          }
          
          logExecution(`TOOL_CALL: ${block.name} | Input: ${logInputStr}`);
          
          const resultPayload = await handleToolCall(block.name, block.input);
          
          logExecution(`TOOL_RESULT: ${typeof resultPayload === 'string' ? resultPayload.substring(0, 200) + (resultPayload.length > 200 ? '...' : '') : 'Multimodal/JSON result'}`);
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof resultPayload === 'string' ? resultPayload : resultPayload
          });
        }
        
        messages.push({
          role: "user",
          content: toolResults
        });
      }
    }
    
    logExecution('--- FINISHED EXECUTION ---\n');
    
  } catch (error: any) {
    spinner.fail(chalk.red('Claude 4.6 Sonnet execution failed.'));
    console.error(chalk.red(error.message));
    const logPath = path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'execution.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: ${error.message}\n`, 'utf8');
    throw error;
  }
}
