// Tujuan: Mendefinisikan skema tipe dan antarmuka (interfaces) bersama untuk modul AI Providers dan adapter router.
// Caller: src/ai/providers/*, src/ai/executor.ts, src/ai/planner.ts
// Dependensi: -
// Main Functions: NormalizedMessage, NormalizedTool, NormalizedResponse, IProviderAdapter
// Side Effects: Tidak ada.

export type NormalizedContentBlock =
  | {
      type: 'text';
      text: string;
      id?: string;
      cache_control?: { type: 'ephemeral' };
    }
  | {
      type: 'tool_use';
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
      cache_control?: { type: 'ephemeral' };
    }
  | {
      type: 'tool_result';
      tool_use_id?: string;
      name?: string;
      content?: string | NormalizedContentBlock[];
      id?: string;
      text?: string;
      cache_control?: { type: 'ephemeral' };
    }
  | {
      type: 'image';
      source?: {
        type: 'base64';
        media_type: string;
        data: string;
      };
      id?: string;
      text?: string;
      cache_control?: { type: 'ephemeral' };
    };

export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | NormalizedContentBlock[];
}

export interface NormalizedTool {
  name: string;
  description?: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface NormalizedResponse {
  content: NormalizedContentBlock[];
  stop_reason: 'tool_use' | 'end_turn' | 'max_tokens' | 'error';
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface IProviderAdapter {
  readonly name: string;
  readonly modelId: string;
  chat(
    messages: NormalizedMessage[],
    tools: NormalizedTool[],
    systemInstruction: string
  ): Promise<NormalizedResponse>;
  generate(prompt: string | NormalizedContentBlock[], temperature?: number): Promise<{ text: string; usage?: { input_tokens?: number; output_tokens?: number } }>;
}
