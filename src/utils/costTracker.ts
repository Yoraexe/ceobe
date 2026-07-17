// Module: src/utils/costTracker.ts
// Tujuan: Melacak penggunaan token API dan menghitung estimasi biaya (USD) per sesi.
// Caller: src/ai/executor.ts, src/ai/supervisor.ts
// v1.8.0: Fase 2 - Cost Tracking & Budget Limits

import chalk from 'chalk';
import { log, executionContext } from './context';

export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Harga per 1 Juta Token (USD) per Mei 2026
const PRICING: Record<string, { input: number; output: number }> = {
  // Gemini
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-exp': { input: 0, output: 0 },
  
  // Anthropic Claude
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-4-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  
  // DeepSeek / GLM (Approximation for open-weights / chinese models)
  'glm-5.1-flash': { input: 0.05, output: 0.05 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-v3': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'qwen-max': { input: 0.40, output: 1.20 },
  'qwen-plus': { input: 0.15, output: 0.45 },
  'kimi': { input: 0.20, output: 0.60 },
  'llama-3': { input: 0.15, output: 0.15 },
  'kimi-k2.6-plus': { input: 0.20, output: 0.60 },
  'qwen-3-max': { input: 0.30, output: 0.90 }
};

function getPricing(): Record<string, { input: number; output: number }> {
  if (process.env.CEOBE_PRICING_OVERRIDE) {
    try {
      return { ...PRICING, ...JSON.parse(process.env.CEOBE_PRICING_OVERRIDE) };
    } catch {
      // Ignore invalid JSON in override
    }
  }
  return PRICING;
}

let globalSessionUsage: TokenUsage[] = [];

function getSessionUsageArray(): TokenUsage[] {
  const ctx = executionContext.getStore();
  if (ctx) {
    if (!ctx.sessionUsage) ctx.sessionUsage = [];
    return ctx.sessionUsage as TokenUsage[];
  }
  return globalSessionUsage;
}

export function resetSession(): void {
  const arr = getSessionUsageArray();
  arr.length = 0; // Clears the array in place
}

export function recordUsage(usage: TokenUsage): void {
  if (Number.isNaN(usage.inputTokens) || typeof usage.inputTokens !== 'number') usage.inputTokens = 0;
  if (Number.isNaN(usage.outputTokens) || typeof usage.outputTokens !== 'number') usage.outputTokens = 0;
  
  // Fix L-13: Guard against negative token counts
  usage.inputTokens = Math.max(0, usage.inputTokens);
  usage.outputTokens = Math.max(0, usage.outputTokens);
  
  getSessionUsageArray().push(usage);
}

export function getSessionCost(): number {
  let totalCost = 0;
  const sessionUsage = getSessionUsageArray();
  for (const usage of sessionUsage) {
    // Find closest matching pricing tier based on model name substring, sorting by length desc to match specific models first (e.g. gpt-4o-mini vs gpt-4o)
    const pricingMap = getPricing();
    const modelKey = Object.keys(pricingMap)
      .sort((a, b) => b.length - a.length)
      // Fix M-29: Use strict prefix matching instead of fuzzy includes to prevent model misattribution
      .find(k => usage.model.toLowerCase().startsWith(k));
    const rates = modelKey ? pricingMap[modelKey] : { input: 0, output: 0 };
    
    const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
    const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
    
    // Fix M-30: Prevent NaN/Infinity poisoning of the total cost
    if (Number.isFinite(inputCost) && Number.isFinite(outputCost)) {
      totalCost += inputCost + outputCost;
    }
  }
  return totalCost;
}

export function checkBudget(maxUsd: number): void {
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) return; // 0 means no limit
  const currentCost = getSessionCost();
  if (currentCost > maxUsd) {
    throw new Error(`BUDGET_EXCEEDED: Eksekusi dihentikan. Biaya saat ini ($${currentCost.toFixed(4)}) melebihi batas anggaran ($${maxUsd.toFixed(4)}).`);
  }
}

export function getCostSummary(): string {
  const totalCost = getSessionCost();
  const sessionUsage = getSessionUsageArray();
  const totalInput = sessionUsage.reduce((sum, u) => sum + u.inputTokens, 0);
  const totalOutput = sessionUsage.reduce((sum, u) => sum + u.outputTokens, 0);
  
  const pricingMap = getPricing();
  const hasUnknownModel = sessionUsage.some(usage => {
    return !Object.keys(pricingMap).some(k => usage.model.toLowerCase().includes(k));
  });

  const costStr = hasUnknownModel ? `$${totalCost.toFixed(4)}+` : `$${totalCost.toFixed(4)}`;
  return `Token: ${totalInput.toLocaleString()} IN, ${totalOutput.toLocaleString()} OUT | Estimasi Biaya: ${costStr}`;
}

export function printCostSummary(): void {
  log(chalk.cyan(`\n📊 Laporan Penggunaan API:`));
  log(chalk.cyan(`  ${getCostSummary()}`));
}
