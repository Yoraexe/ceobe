export interface KeyDefinition {
  envKey: string;        // The actual env var name (e.g. GEMINI_API_KEY)
  provider: string;      // Friendly provider slug (e.g. gemini)
  label: string;         // Human-readable label
  docsUrl: string;       // Where to get the key
}

export const KEY_DEFINITIONS: KeyDefinition[] = [
  {
    envKey: 'GEMINI_API_KEY',
    provider: 'gemini',
    label: 'Google Gemini',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    envKey: 'ANTHROPIC_API_KEY',
    provider: 'anthropic',
    label: 'Anthropic Claude',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    envKey: 'GLM_API_KEY',
    provider: 'glm',
    label: 'Zhipu AI GLM',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    envKey: 'KIMI_API_KEY',
    provider: 'kimi',
    label: 'Moonshot AI Kimi',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    envKey: 'DEEPSEEK_API_KEY',
    provider: 'deepseek',
    label: 'DeepSeek',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    envKey: 'GROQ_API_KEY',
    provider: 'groq',
    label: 'Groq (Llama, Mixtral)',
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    envKey: 'OPENAI_API_KEY',
    provider: 'openai',
    label: 'OpenAI (GPT-4o)',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    envKey: 'TOGETHER_API_KEY',
    provider: 'together',
    label: 'Together AI',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
  },
  {
    envKey: 'QWEN_API_KEY',
    provider: 'qwen',
    label: 'Alibaba Qwen',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  {
    envKey: 'CLOUDFLARE_ACCOUNT_ID',
    provider: 'cloudflare-account',
    label: 'Cloudflare Account ID (opsional, untuk AI Gateway)',
    docsUrl: 'https://dash.cloudflare.com',
  },
  {
    envKey: 'CLOUDFLARE_GATEWAY_ID',
    provider: 'cloudflare-gateway',
    label: 'Cloudflare Gateway ID (opsional, untuk AI Gateway)',
    docsUrl: 'https://dash.cloudflare.com',
  },
  {
    envKey: 'TELEGRAM_BOT_TOKEN',
    provider: 'telegram-token',
    label: 'Telegram Bot Token (untuk ceobe daemon)',
    docsUrl: 'https://t.me/BotFather',
  },
  {
    envKey: 'TELEGRAM_ALLOWED_USERS',
    provider: 'telegram-allowed-users',
    label: 'Telegram Allowed User IDs (pisah koma, misal: 123456,789012)',
    docsUrl: 'https://t.me/userinfobot',
  },
  {
    envKey: 'CEOBE_PLANNER_PROVIDER',
    provider: 'planner-provider',
    label: 'Planner Provider (gemini/glm/kimi/claude/deepseek/groq/openai/ollama)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_PLANNER_MODEL',
    provider: 'planner-model',
    label: 'Planner Model Override (opsional)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EXECUTOR_PROVIDER',
    provider: 'executor-provider',
    label: 'Executor Provider (claude/glm/kimi/deepseek/groq/openai/ollama)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EXECUTOR_MODEL',
    provider: 'executor-model',
    label: 'Executor Model Override (opsional)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_QA_PROVIDER',
    provider: 'qa-provider',
    label: 'QA Auditor Provider (gemini/claude/deepseek/glm/...)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_QA_MODEL',
    provider: 'qa-model',
    label: 'QA Auditor Model Override (opsional)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EMBEDDING_PROVIDER',
    provider: 'embedding-provider',
    label: 'Embedding Provider (gemini/glm/openai/ollama - opsional)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_EMBEDDING_MODEL',
    provider: 'embedding-model',
    label: 'Embedding Model Override (opsional)',
    docsUrl: 'https://github.com/your-repo/ceobe#providers',
  },
  {
    envKey: 'CEOBE_MAX_BUDGET',
    provider: 'max-budget',
    label: 'Budget Limit USD (0 untuk tanpa limit)',
    docsUrl: '',
  },
];

import { env } from '../config/env';

export function getRequiredKeyForActiveProviders(): string[] {
  const rawPlanner = (env.CEOBE_PLANNER_PROVIDER || '').toLowerCase();
  const rawExecutor = (env.CEOBE_EXECUTOR_PROVIDER || '').toLowerCase();
  
  const plannerProvider = rawPlanner || rawExecutor;
  const executorProvider = rawExecutor || rawPlanner;
  const qaProvider = (env.CEOBE_QA_PROVIDER || plannerProvider).toLowerCase();
  const embeddingProvider = (env.CEOBE_EMBEDDING_PROVIDER || plannerProvider).toLowerCase();

  const PROVIDER_KEY_MAP: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    claude: 'ANTHROPIC_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    glm: 'GLM_API_KEY',
    kimi: 'KIMI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    groq: 'GROQ_API_KEY',
    together: 'TOGETHER_API_KEY',
    qwen: 'QWEN_API_KEY',
    openai: 'OPENAI_API_KEY',
    ollama: '',
  };

  const required = new Set<string>();
  [plannerProvider, executorProvider, qaProvider, embeddingProvider].forEach(p => {
    if (!p) return;
    const key = PROVIDER_KEY_MAP[p];
    if (key) required.add(key);
  });
  return Array.from(required);
}

export function findKeyDef(providerOrEnvKey: string): KeyDefinition | undefined {
  const q = providerOrEnvKey.toLowerCase();
  return KEY_DEFINITIONS.find(
    (k) =>
      k.provider.toLowerCase() === q ||
      k.envKey.toLowerCase() === q ||
      k.envKey.toLowerCase().replace('_api_key', '') === q
  );
}
