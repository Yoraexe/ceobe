// Module: src/ai/providers/geminiAdapter.ts
// Purpose: Adapts the Google Gemini API to Ceobe's normalized IProviderAdapter interface.
// Caller: src/ai/providers/router.ts
// Dependencies: @google/genai, config/env, types
// Side Effects: Makes HTTP requests to Google Generative AI

import { GoogleGenAI } from '@google/genai';
import * as crypto from 'crypto';
import { env } from '../../config/env';
import { withRetry } from '../../utils/retry';
import type { NormalizedContentBlock } from './types';
import type {
  IProviderAdapter,
  NormalizedMessage,
  NormalizedTool,
  NormalizedResponse,
} from './types';

export class GeminiAdapter implements IProviderAdapter {
  readonly name = 'gemini';
  readonly modelId: string;
  private client: unknown;

  constructor(modelId: string = 'gemini-2.5-pro') {
    this.modelId = modelId;
  }

  private getClient(): Record<string, unknown> {
    if (!this.client) {
      const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, apiVersion: 'v1beta' });
      this.client = genAI.models;
    }
    return this.client as Record<string, unknown>;
  }

  async generate(prompt: string | NormalizedContentBlock[], temperature: number = 0.2): Promise<{ text: string; usage?: { input_tokens?: number; output_tokens?: number } }> {
    const client = this.getClient();
    
    let parts: Array<Record<string, unknown>> = [];
    if (typeof prompt === 'string') {
      parts = [{ text: prompt }];
    } else {
      parts = prompt.map((block: NormalizedContentBlock) => {
        if (block.type === 'text') return { text: block.text };
        if (block.type === 'image' && block.source) {
          return {
            inlineData: {
              mimeType: block.source.media_type,
              data: block.source.data,
            },
          };
        }
        return { text: '' };
      });
    }

    const response = await withRetry(() =>
      (client as { generateContent: (args: unknown) => Promise<unknown> }).generateContent({
        model: this.modelId,
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature },
      })
    );
    const res = response as any;
    const text = typeof res.text === 'function' ? res.text() : (res.text || '');
    const usage = res.usageMetadata ? { input_tokens: res.usageMetadata.promptTokenCount, output_tokens: res.usageMetadata.candidatesTokenCount } : undefined;
    return { text: text.trim(), usage };
  }

  async chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse> {
    const geminiTools = tools.length > 0 ? [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties: t.input_schema.properties,
          required: t.input_schema.required,
        }
      }))
    }] : undefined;

    const toolIdToName = new Map<string, string>();
    for (const m of messages) {
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === 'tool_use' && block.id && block.name) {
            toolIdToName.set(block.id, block.name);
          }
        }
      }
    }

    const contents = messages.map(msg => {
      let parts: any[] = [];
      if (typeof msg.content === 'string') {
        parts = [{ text: msg.content }];
      } else {
        parts = msg.content.map(b => {
          if (b.type === 'text') return { text: b.text };
          if (b.type === 'tool_use') return { functionCall: { name: b.name, args: b.input } };
          if (b.type === 'tool_result') {
            const resp = typeof b.content === 'string' ? { result: b.content } : Array.isArray(b.content) ? { result: JSON.stringify(b.content) } : (b.content || {});
            const resolvedName = b.name || (b.tool_use_id ? toolIdToName.get(b.tool_use_id) : undefined);
            if (!resolvedName) throw new Error(`tool_result block missing name and could not be resolved via tool_use_id: ${b.tool_use_id}`);
            return { functionResponse: { name: resolvedName, response: resp } };
          }
          if (b.type === 'image' && b.source) return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
          return { text: '' };
        });
      }
      return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
    });

    const res = await withRetry(() =>
      (this.getClient() as any).generateContent({
        model: this.modelId,
        contents,
        tools: geminiTools,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: { temperature: 0 },
      })
    ) as any;

    const usage = res.usageMetadata ? { input_tokens: res.usageMetadata.promptTokenCount, output_tokens: res.usageMetadata.candidatesTokenCount } : undefined;
    
    // Parse Gemini response back to NormalizedResponse
    const responseContent: NormalizedContentBlock[] = [];
    let stopReason = 'end_turn';

    if (res.candidates && res.candidates.length > 0) {
      const candidate = res.candidates[0];
      if (candidate.finishReason === 'MAX_TOKENS') {
        stopReason = 'max_tokens';
      } else if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
        stopReason = 'error';
        responseContent.push({ type: 'text', text: `[Gemini Error] Stopped due to finish reason: ${candidate.finishReason}` });
      }
      
      const parts = candidate.content?.parts || [];
      for (const p of parts) {
        if (p.text) {
          responseContent.push({ type: 'text', text: p.text });
        }
        if (p.functionCall) {
          stopReason = 'tool_use';
          responseContent.push({
            type: 'tool_use',
            id: p.functionCall.name + '_' + crypto.randomUUID().substring(0, 8),
            name: p.functionCall.name,
            input: p.functionCall.args || {}
          });
        }
      }
    } else {
      const text = typeof res.text === 'function' ? res.text() : (res.text || '');
      responseContent.push({ type: 'text', text });
    }

    return {
      content: responseContent,
      stop_reason: stopReason,
      usage
    };
  }
}
