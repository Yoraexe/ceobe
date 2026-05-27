// Module: src/ai/providers/geminiAdapter.ts
// Purpose: Adapts the Google Gemini API to Ceobe's normalized IProviderAdapter interface.
// Caller: src/ai/providers/router.ts
// Dependencies: @google/genai, config/env, types
// Side Effects: Makes HTTP requests to Google Generative AI

import { GoogleGenAI } from '@google/genai';
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

  async generate(prompt: string | NormalizedContentBlock[], temperature: number = 0.2): Promise<string> {
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
    return text.trim();
  }

  async chat(
    messages: NormalizedMessage[],
    _tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse> {
    // Basic chat implementation for Gemini (can be expanded with tool calling)
    // For now, we focus on planning compatibility.
    const lastMsg = messages[messages.length - 1];
    const prompt = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
    
    // Extract usage if available from underlying SDK
    const res = await withRetry(() =>
      (this.getClient() as { generateContent: (args: unknown) => Promise<unknown> }).generateContent({
        model: this.modelId,
        contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0 },
      })
    ) as any;
    
    const text = typeof res.text === 'function' ? res.text() : (res.text || '');
    const usage = res.usageMetadata ? { input_tokens: res.usageMetadata.promptTokenCount, output_tokens: res.usageMetadata.candidatesTokenCount } : undefined;

    return {
      content: [{ type: 'text', text: text.trim() }],
      stop_reason: 'end_turn',
      usage
    };
  }
}
