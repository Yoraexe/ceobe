// Tujuan: Menyediakan singleton instance GoogleGenAI untuk digunakan di seluruh modul (Planner, Indexer).
// Caller: src/ai/planner.ts, src/ai/memory/indexer.ts
// Dependensi: @google/genai, config/env, gateway
// Main Functions: getGeminiClient
// Side Effects: None

import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { getGatewayUrl } from './gateway';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        baseUrl: getGatewayUrl('google-genai')
      }
    });
  }
  return client;
}
