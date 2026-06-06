// Module: src/ai/providers/anthropicAdapter.ts
// Purpose: Adapts the Anthropic Claude API to Ceobe's normalized IProviderAdapter interface.
// Caller: src/ai/providers/router.ts
// Dependencies: @anthropic-ai/sdk, config/env, ai/gateway, types
// Side Effects: Makes HTTP requests to Anthropic API (via Cloudflare Gateway)

import Anthropic from '@anthropic-ai/sdk';
import { env, getGatewayUrl } from '../../config/env';
import { withRetry } from '../../utils/retry';
import type {
  IProviderAdapter,
  NormalizedMessage,
  NormalizedTool,
  NormalizedResponse,
  NormalizedContentBlock,
} from './types';

export class AnthropicAdapter implements IProviderAdapter {
  readonly name = 'anthropic';
  readonly modelId: string;
  private client: Anthropic;

  constructor(modelId: string = 'claude-sonnet-4-5') {
    this.modelId = modelId;
    const gatewayUrl = getGatewayUrl('anthropic');
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(gatewayUrl ? { baseURL: gatewayUrl } : {}),
    });
  }

  async generate(prompt: string | NormalizedContentBlock[], temperature: number = 0.2): Promise<{ text: string; usage?: { input_tokens?: number; output_tokens?: number } }> {
    const isArray = Array.isArray(prompt);
    const hasExplicitCache = isArray && (prompt as NormalizedContentBlock[]).some(b => b.cache_control);

    const content = typeof prompt === 'string' 
      ? [
          { 
            type: 'text', 
            text: prompt, 
            cache_control: prompt.length > 2000 ? { type: 'ephemeral' } : undefined 
          }
        ] 
      : (prompt as any[]).map((block, index) => {
          let outBlock: any = { type: 'text', text: '' };
          if (block.type === 'text') outBlock = { type: 'text', text: block.text };
          if (block.type === 'image' && block.source) {
            outBlock = {
              type: 'image',
              source: {
                type: 'base64',
                media_type: block.source.media_type,
                data: block.source.data,
              }
            };
          }
          
          if (hasExplicitCache) {
             if (block.cache_control) outBlock.cache_control = { type: 'ephemeral' };
          } else {
             // Default: Put cache control on the last block
             if (index === (prompt as any[]).length - 1) {
                outBlock.cache_control = { type: 'ephemeral' };
             }
          }
          return outBlock;
        });

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.modelId,
        max_tokens: env.CEOBE_MAX_TOKENS,
        temperature,
        messages: [{ role: 'user', content }] as Anthropic.MessageParam[],
      })
    );
    const block = response.content.find(c => c.type === 'text') as Anthropic.TextBlock | undefined;
    const text = (block?.text || '').trim();
    const usage = response.usage ? { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens } : undefined;
    return { text, usage };
  }

  async chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse> {
    
    // Inject cache_control into system prompt
    const system = [
      {
        type: 'text',
        text: systemInstruction,
        cache_control: { type: 'ephemeral' }
      }
    ] as any;

    // Inject cache_control into the very last user message to cache history up to that point
    const anthropicMessages = messages.map(m => {
       const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
       return { role: m.role, content: JSON.parse(JSON.stringify(content)) };
    }) as any[];
    
    for (let i = anthropicMessages.length - 1; i >= 0; i--) {
       if (anthropicMessages[i].role === 'user') {
          const contentArray = anthropicMessages[i].content;
          if (Array.isArray(contentArray) && contentArray.length > 0) {
             contentArray[contentArray.length - 1].cache_control = { type: 'ephemeral' };
          }
          break;
       }
    }

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.modelId,
        max_tokens: env.CEOBE_MAX_TOKENS,
        temperature: 0,
        system: system,
        messages: anthropicMessages as Anthropic.MessageParam[],
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })) as Anthropic.Tool[],
      })
    );

    const content: NormalizedContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') return { type: 'text', text: block.text };
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      return { type: 'text', text: '' };
    });

    const stopReason =
      response.stop_reason === 'tool_use'
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
        ? 'max_tokens'
        : 'end_turn';

    return { 
      content, 
      stop_reason: stopReason,
      usage: response.usage ? { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens } : undefined
    };
  }
}
