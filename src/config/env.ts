import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables from .env file
dotenv.config();

import path from 'path';

export interface EnvConfig {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_GATEWAY_ID: string;
  GEMINI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  CEOBE_INSTALL_DIR: string;
  TARGET_PROJECT_DIR: string;
}

export function loadEnv(): EnvConfig {
  const missingKeys: string[] = [];

  const getEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
      missingKeys.push(key);
      return '';
    }
    return value;
  };

  const config: EnvConfig = {
    CLOUDFLARE_ACCOUNT_ID: getEnv('CLOUDFLARE_ACCOUNT_ID'),
    CLOUDFLARE_GATEWAY_ID: getEnv('CLOUDFLARE_GATEWAY_ID'),
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY'),
    ANTHROPIC_API_KEY: getEnv('ANTHROPIC_API_KEY'),
    // The location of Ceobe's brain (skills, templates, rules)
    CEOBE_INSTALL_DIR: process.env.CEOBE_INSTALL_DIR || path.resolve(__dirname, '../../'),
    // The user's current terminal directory where code is written
    TARGET_PROJECT_DIR: process.cwd(),
  };

  if (missingKeys.length > 0) {
    console.error(chalk.red(`[Error] Missing required environment variables:`));
    missingKeys.forEach(key => console.error(chalk.red(`  - ${key}`)));
    console.error(chalk.yellow(`\nPlease set them in your .env file or system environment variables.`));
    process.exit(1);
  }

  return config;
}

export const env = loadEnv();
