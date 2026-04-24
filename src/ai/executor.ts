import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { getGatewayUrl } from './gateway';
import chalk from 'chalk';
import ora from 'ora';
import { tools, handleToolCall } from './tools/systemTools';
import { withRetry } from '../utils/retry';

export async function executePlan(planMarkdown: string): Promise<void> {
  const spinner = ora('Claude 4.6 Sonnet is executing the plan...').start();
  
  try {
    const gatewayUrl = getGatewayUrl('anthropic');
    const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: gatewayUrl
    });

    const systemInstruction = `
You are the Execution Engine of the Ceobe AI System.
Your task is to take the provided execution plan and strictly implement it.
You have access to tool commands if run within an agent wrapper, otherwise output the exact code and terminal commands required to fulfill the user's request.
DO NOT provide planning commentary. DO NOT hallucinate dependencies. Write code.
`;

    let messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Execute the following plan:\n\n${planMarkdown}`
      }
    ];

    let isThinking = true;
    while (isThinking) {
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
          const resultText = await handleToolCall(block.name, block.input);
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultText
          });
        }
        
        messages.push({
          role: "user",
          content: toolResults
        });
      }
    }
    
  } catch (error: any) {
    spinner.fail(chalk.red('Claude 4.6 Sonnet execution failed.'));
    console.error(chalk.red(error.message));
    throw error;
  }
}
