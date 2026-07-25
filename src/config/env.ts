// Tujuan: Memuat, mem-parsing, dan memvalidasi seluruh variabel lingkungan (environment variables) konfigurasi Ceobe.
// Caller: Seluruh file sumber kode Ceobe yang membutuhkan environment configuration.
// Dependensi: fs, path, os, dotenv
// Main Functions: loadEnv, reloadEnv, getGatewayUrl, env
// Side Effects: Membaca berkas .ceobe/keys.json dan .env.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import dotenv from 'dotenv';

const ALLOWED_STORED_KEYS = new Set([
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ALLOWED_USERS',
  'GLM_API_KEY',
  'KIMI_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROQ_API_KEY',
  'TOGETHER_API_KEY',
  'QWEN_API_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_GATEWAY_ID',
  'CEOBE_PLANNER_PROVIDER',
  'CEOBE_PLANNER_MODEL',
  'CEOBE_EXECUTOR_PROVIDER',
  'CEOBE_EXECUTOR_MODEL',
  'CEOBE_QA_PROVIDER',
  'CEOBE_QA_MODEL',
  'CEOBE_EMBEDDING_PROVIDER',
  'CEOBE_EMBEDDING_MODEL',
  'CEOBE_MAX_BUDGET',
  'CEOBE_MAX_TOKENS',
  'CEOBE_SANDBOX',
  'CEOBE_SANDBOX_IMAGE',
]);

function injectStoredKeys(): void {
  const keysPath = path.join(os.homedir(), '.ceobe', 'keys.json');
  if (!fs.existsSync(keysPath)) return;
  try {
    const stored = JSON.parse(fs.readFileSync(keysPath, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(stored)) {
      if (v && ALLOWED_STORED_KEYS.has(k) && typeof v === 'string' && v.trim().length > 0 && !process.env[k]) {
        process.env[k] = v.trim();
      }
    }
  } catch {
    // Silently ignore corrupt key store
  }
}

injectStoredKeys();

// ── Step 2: Load .env file as lowest-priority fallback
dotenv.config();

export interface EnvConfig {
  // Cloudflare AI Gateway (optional — only needed when routing via CF)
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_GATEWAY_ID: string;
  // Core AI keys
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  // Planner provider selection
  CEOBE_PLANNER_PROVIDER: string;   // 'gemini' | 'claude' | 'glm' | 'kimi' | etc.
  CEOBE_PLANNER_MODEL: string;      // Optional model override
  // Executor provider selection
  CEOBE_EXECUTOR_PROVIDER: string;  // 'claude' | 'glm' | 'kimi' | etc.
  CEOBE_EXECUTOR_MODEL: string;     // Optional model override
  // QA / Auditor provider selection (independent from Planner & Executor)
  // Best practice: use a DIFFERENT provider than Planner to avoid self-evaluation bias.
  // Falls back to PLANNER if not set.
  CEOBE_QA_PROVIDER: string;        // 'gemini' | 'claude' | 'glm' | etc.
  CEOBE_QA_MODEL: string;           // Optional model override
  // Embedding provider selection
  CEOBE_EMBEDDING_PROVIDER: string; // 'gemini' | 'openai' | 'glm' | etc.
  CEOBE_EMBEDDING_MODEL: string;
  // Per-provider API keys (only required for the active provider)
  GLM_API_KEY: string;
  KIMI_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  GROQ_API_KEY: string;
  TOGETHER_API_KEY: string;
  QWEN_API_KEY: string;
  OPENAI_API_KEY: string;
  // System
  CEOBE_INSTALL_DIR: string;
  TARGET_PROJECT_DIR: string;
  CEOBE_SANDBOX: 'docker' | 'none';
  CEOBE_SANDBOX_IMAGE: string;
  CEOBE_MAX_BUDGET: number;
  CEOBE_MAX_TOKENS: number;
}

export function loadEnv(): EnvConfig {

  /** Optional keys — returns empty string if absent, no crash */
  const getOptional = (key: string): string => process.env[key] || '';

  const config: EnvConfig = {
    CLOUDFLARE_ACCOUNT_ID: getOptional('CLOUDFLARE_ACCOUNT_ID'),
    CLOUDFLARE_GATEWAY_ID: getOptional('CLOUDFLARE_GATEWAY_ID'),
    // All keys are optional here — validation is done per-provider in router
    GEMINI_API_KEY: getOptional('GEMINI_API_KEY'),
    ANTHROPIC_API_KEY: getOptional('ANTHROPIC_API_KEY'),
    // Planner provider routing (no defaults)
    CEOBE_PLANNER_PROVIDER: getOptional('CEOBE_PLANNER_PROVIDER') || '',
    CEOBE_PLANNER_MODEL: getOptional('CEOBE_PLANNER_MODEL'),
    // Executor provider routing (no defaults)
    CEOBE_EXECUTOR_PROVIDER: getOptional('CEOBE_EXECUTOR_PROVIDER') || '',
    CEOBE_EXECUTOR_MODEL: getOptional('CEOBE_EXECUTOR_MODEL'),
    // QA provider routing (falls back to planner if not explicitly set)
    CEOBE_QA_PROVIDER: getOptional('CEOBE_QA_PROVIDER') || '',
    CEOBE_QA_MODEL: getOptional('CEOBE_QA_MODEL'),
    // Embedding provider routing (defaults to planner if unset)
    CEOBE_EMBEDDING_PROVIDER: getOptional('CEOBE_EMBEDDING_PROVIDER') || '',
    CEOBE_EMBEDDING_MODEL: getOptional('CEOBE_EMBEDDING_MODEL'),
    GLM_API_KEY: getOptional('GLM_API_KEY'),
    KIMI_API_KEY: getOptional('KIMI_API_KEY'),
    DEEPSEEK_API_KEY: getOptional('DEEPSEEK_API_KEY'),
    GROQ_API_KEY: getOptional('GROQ_API_KEY'),
    TOGETHER_API_KEY: getOptional('TOGETHER_API_KEY'),
    QWEN_API_KEY: getOptional('QWEN_API_KEY'),
    OPENAI_API_KEY: getOptional('OPENAI_API_KEY'),
    CEOBE_INSTALL_DIR: getOptional('CEOBE_INSTALL_DIR') || path.resolve(__dirname, '../../'),
    TARGET_PROJECT_DIR: process.cwd(),
    CEOBE_SANDBOX: (['docker', 'none'].includes(process.env.CEOBE_SANDBOX as string) ? process.env.CEOBE_SANDBOX : 'none') as 'docker' | 'none', // Fix M-03: Safe default fallback to 'none' when not configured
    CEOBE_SANDBOX_IMAGE: getOptional('CEOBE_SANDBOX_IMAGE') || '',
    CEOBE_MAX_BUDGET: process.env.CEOBE_MAX_BUDGET === '0' ? 0 : (parseFloat(getOptional('CEOBE_MAX_BUDGET')) || 5),
    CEOBE_MAX_TOKENS: parseInt(getOptional('CEOBE_MAX_TOKENS'), 10) || 16384,
  };

  return config;
}

export let env = Object.freeze(loadEnv());

export function reloadEnv(): void {
  env = Object.freeze(loadEnv());
}

/**
 * Constructs the Cloudflare AI Gateway URL for a given provider.
 * Returns an empty string if Cloudflare credentials are not configured.
 */
export function getGatewayUrl(provider: string): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_GATEWAY_ID) {
    return '';
  }
  
  const providerSlugMap: Record<string, string> = {
    'google-genai': 'google-genai',
    '@google/genai': 'google-genai',
    'anthropic': 'anthropic',
    'openrouter': 'openrouter',
    'openai': 'openai',
  };

  const slug = providerSlugMap[provider] || provider.replace(/[^a-zA-Z0-9-]/g, '-');
  return `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/${slug}`;
}
