// Module: src/ai/providers/openAICompatibleAdapter.ts
// Purpose: Universal adapter for any OpenAI-compatible API.
//          Covers: GLM (Zhipu), Kimi (Moonshot), DeepSeek, Qwen, Groq, Together AI, Ollama, etc.
// Caller: src/ai/providers/router.ts
// Dependencies: openai, types
// Side Effects: Makes HTTP requests to the configured base URL

import OpenAI from 'openai';
import { withRetry } from '../../utils/retry';
import type {
  IProviderAdapter,
  NormalizedMessage,
  NormalizedTool,
  NormalizedResponse,
  NormalizedContentBlock,
} from './types';

/**
 * Converts Ceobe's normalized tool format to OpenAI's function-calling format.
 */
function toOpenAITools(tools: NormalizedTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

/**
 * Converts Ceobe's normalized messages to OpenAI chat messages.
 */
function toOpenAIMessages(
  messages: NormalizedMessage[],
  systemInstruction: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
  ];

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'system') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else {
        // Handle tool_result content blocks (from previous tool calls)
        const toolResults = msg.content.filter((b) => b.type === 'tool_result');
        for (const tr of toolResults) {
          result.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id!,
            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
          });
        }
        // Handle plain text in user messages
        const textBlocks = msg.content.filter((b) => b.type === 'text');
        if (textBlocks.length > 0) {
          result.push({ role: 'user', content: textBlocks.map((b) => b.text).join('\n') });
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'assistant', content: msg.content });
      } else {
        const toolUses = msg.content.filter((b) => b.type === 'tool_use');
        const textBlock = msg.content.find((b) => b.type === 'text');
        result.push({
          role: 'assistant',
          content: textBlock?.text ?? null,
          tool_calls: toolUses.length > 0
            ? toolUses.map((tu) => ({
                id: tu.id!,
                type: 'function' as const,
                function: {
                  name: tu.name!,
                  arguments: JSON.stringify(tu.input ?? {}),
                },
              }))
            : undefined,
        });
      }
    }
  }

  return result;
}

export class OpenAICompatibleAdapter implements IProviderAdapter {
  readonly name: string;
  readonly modelId: string;
  private client: OpenAI;

  /**
   * @param name      - Human-readable name, e.g. 'glm', 'kimi', 'deepseek'
   * @param modelId   - The exact model string to pass to the API, e.g. 'glm-4-flash'
   * @param apiKey    - Provider API key
   * @param baseURL   - Provider's base URL (OpenAI-compatible endpoint)
   */
  constructor(name: string, modelId: string, apiKey: string, baseURL: string) {
    this.name = name;
    this.modelId = modelId;
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generate(prompt: string | NormalizedContentBlock[], temperature: number = 0.2): Promise<string> {
    const contentStr = typeof prompt === 'string'
      ? prompt
      : prompt.filter(b => b.type === 'text').map(b => b.text).join('\n');

    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: 'user', content: contentStr }],
        temperature,
      })
    );
    return (response.choices[0]?.message?.content || '').trim();
  }

  async chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse> {
    const oaiMessages = toOpenAIMessages(messages, systemInstruction);
    const oaiTools = toOpenAITools(tools);

    const response = await withRetry(() =>
      this.client.chat.completions.create({
        model: this.modelId,
        messages: oaiMessages,
        tools: oaiTools.length > 0 ? oaiTools : undefined,
        tool_choice: oaiTools.length > 0 ? 'auto' : undefined,
        temperature: 0,
      })
    );

    const choice = response.choices[0];
    const content: NormalizedContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls as Array<{ id: string, function: { name: string, arguments: string } }>) {
          let parsedInput = {};
          try {
            parsedInput = JSON.parse(tc.function.arguments || '{}');
          } catch (e) {
            parsedInput = {};
          }
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: parsedInput,
          });
      }
    }

    const finishReason = choice.finish_reason;
    const stopReason =
      finishReason === 'tool_calls'
        ? 'tool_use'
        : finishReason === 'length'
        ? 'max_tokens'
        : 'end_turn';

    return { 
      content, 
      stop_reason: stopReason,
      usage: response.usage ? { input_tokens: response.usage.prompt_tokens, output_tokens: response.usage.completion_tokens } : undefined
    };
  }
}
