// Module: src/ai/providers/types.ts
// Purpose: Shared types for the Provider Router abstraction layer.
// Caller: executor.ts, all provider implementations
// Dependencies: none
// Side Effects: none

/**
 * Normalized message format used across all providers.
 * Maps to OpenAI/Claude/GLM chat format.
 */
export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | NormalizedContentBlock[];
}

export interface NormalizedContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  text?: string;
  content?: string;
  // For multimodal
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * A normalized tool definition (Ceobe's internal format).
 * Converted to the target provider's format before being sent.
 */
export interface NormalizedTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * A normalized response from any provider.
 */
export interface NormalizedResponse {
  content: NormalizedContentBlock[];
  stop_reason: 'tool_use' | 'end_turn' | 'max_tokens' | string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Interface that every provider adapter must implement.
 */
export interface IProviderAdapter {
  readonly name: string;
  readonly modelId: string;
  chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse>;
}
