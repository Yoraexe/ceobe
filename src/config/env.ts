// Module: src/config/env.ts
// Purpose: Loads and validates all environment configuration.
//          Priority order: ~/.ceobe/keys.json > system env vars > .env file
// Caller: Every module in Ceobe
// Dependencies: dotenv, chalk, path, os, fs (via keyManager)
// Side Effects: Reads ~/.ceobe/keys.json; reads .env file; calls process.exit on validation failure

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import dotenv from 'dotenv';
import chalk from 'chalk';

// ── Step 1: Inject keys from ~/.ceobe/keys.json into process.env
//    This runs BEFORE dotenv so stored keys take highest priority.
function injectStoredKeys(): void {
  const keysPath = path.join(os.homedir(), '.ceobe', 'keys.json');
  if (!fs.existsSync(keysPath)) return;
  try {
    const stored = JSON.parse(fs.readFileSync(keysPath, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(stored)) {
      if (v && !process.env[k]) {
        // Only inject if not already set by system env (system env wins over stored keys)
        process.env[k] = v;
      }
    }
  } catch {
    // Silently ignore corrupt key store — user can run `ceobe key list` to diagnose
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
}

export function loadEnv(): EnvConfig {
  const missingKeys: string[] = [];

  /** Required keys — app cannot start without these */
  const getEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      missingKeys.push(key);
      return '';
    }
    return value;
  };

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
    CEOBE_SANDBOX: (process.env.CEOBE_SANDBOX as 'docker' | 'none') || 'none',
  };

  if (missingKeys.length > 0) {
    if (process.env.VITEST) {
      missingKeys.forEach(key => { (config as any)[key] = 'test_dummy'; });
    } else {
      console.error(chalk.red('\n[Ceobe] API key belum dikonfigurasi:'));
      missingKeys.forEach(key => console.error(chalk.red(`  ✗ ${key}`)));
      console.error(chalk.yellow('\nJalankan perintah berikut untuk mengaturnya:'));
      console.error(chalk.cyan('  ceobe setup\n'));
      process.exit(1);
    }
  }

  return config;
}

/**
 * Constructs the Cloudflare AI Gateway URL for a given provider.
 * Returns an empty string if Cloudflare credentials are not configured.
 */
export function getGatewayUrl(provider: 'google-genai' | '@google/genai' | 'anthropic'): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_GATEWAY_ID) {
    return '';
  }
  const slug = provider.includes('/') ? provider.split('/')[1] : provider;
  return `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/${slug}`;
}

export const env = loadEnv();
