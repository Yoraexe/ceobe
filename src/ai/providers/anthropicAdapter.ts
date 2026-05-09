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

  async generate(prompt: string | NormalizedContentBlock[], temperature: number = 0.2): Promise<string> {
    const content = typeof prompt === 'string' 
      ? prompt 
      : (prompt as any[]).map(block => {
          if (block.type === 'text') return { type: 'text', text: block.text };
          if (block.type === 'image' && block.source) {
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: block.source.media_type,
                data: block.source.data,
              }
            };
          }
          return { type: 'text', text: '' };
        });

    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.modelId,
        max_tokens: 8192,
        temperature,
        messages: [{ role: 'user', content }] as Anthropic.MessageParam[],
      })
    );
    const block = response.content.find(c => c.type === 'text') as Anthropic.TextBlock | undefined;
    return (block?.text || '').trim();
  }

  async chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse> {
    const response = await withRetry(() =>
      this.client.messages.create({
        model: this.modelId,
        max_tokens: 8192,
        temperature: 0,
        system: systemInstruction,
        messages: messages as Anthropic.MessageParam[],
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

    return { content, stop_reason: stopReason };
  }
}
