// Tujuan: Menjalankan serangkaian benchmark pengujian kinerja AI models terhadap tugas pembuatan kode standar.
// Caller: src/cli/commands/system/benchmarkCmd.ts
// Dependensi: providers/router, dotenv
// Main Functions: runBenchmarkSuite
// Side Effects: Tidak ada.

import { createProviderAdapter } from '../providers/router';

import 'dotenv/config';

interface BenchmarkTask {
  name: string;
  description: string;
  prompt: string;
}

const TASKS: BenchmarkTask[] = [
  {
    name: 'Simple API Endpoint',
    description: 'Build a single endpoint to return user profile.',
    prompt: 'Tuliskan kode untuk membuat endpoint /api/user yang mengembalikan data statis user {id: 1, name: "Ceobe"}. Gunakan Express. Jangan gunakan class atau interface berlebihan.'
  },
  {
    name: 'Config Loader',
    description: 'Build a utility to load configuration from env.',
    prompt: 'Buat fungsi utilitas untuk membaca variabel environment PORT dan DB_URL, dengan default PORT=3000.'
  }
];

export interface BenchmarkResult {
  model: string;
  taskResults: {
    taskName: string;
    passed: boolean;
    timeMs: number;
    tokens: number;
  }[];
  score: number;
}

export async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const models = [];
  if (process.env.OPENAI_API_KEY) models.push({ id: 'gpt-4o-mini', role: 'planner' });
  if (process.env.ANTHROPIC_API_KEY) models.push({ id: 'claude-3-5-sonnet-20241022', role: 'planner' });
  if (process.env.GEMINI_API_KEY) models.push({ id: 'gemini-2.5-flash', role: 'planner' });

  if (models.length === 0) {
    throw new Error('No API keys found in .env (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY).');
  }

  const results: BenchmarkResult[] = [];

  for (const modelDef of models) {
    // Override env variable to force the provider for this iteration
    let originalProvider = process.env.CEOBE_PLANNER_PROVIDER;
    if (modelDef.id.startsWith('gpt')) process.env.CEOBE_PLANNER_PROVIDER = 'openai';
    if (modelDef.id.startsWith('claude')) process.env.CEOBE_PLANNER_PROVIDER = 'anthropic';
    if (modelDef.id.startsWith('gemini')) process.env.CEOBE_PLANNER_PROVIDER = 'gemini';

    const adapter = createProviderAdapter('planner');
    
    const benchmarkResult: BenchmarkResult = {
      model: modelDef.id,
      taskResults: [],
      score: 0
    };

    for (const task of TASKS) {
      const prompt = `You are the Brain of the Ceobe AI Engineering System. You are a Senior Architect.
STAGE: BENCHMARK EXECUTION.

You are a lazy senior developer. Lazy means efficient.
1. Use Standard Library (STDLIB) features over external packages.
2. No abstractions that weren't explicitly requested.
3. Keep the code minimal.

Current Task:
${task.prompt}

Output ONLY the raw code or raw JSON execution steps needed. Do not use markdown blocks.`;
      
      const startTime = Date.now();
      let genResult;
      try {
        genResult = await adapter.generate(prompt, 0.1);
      } catch (e) {
        console.error(`Error with model ${modelDef.id}:`, e);
        continue;
      }
      const timeMs = Date.now() - startTime;
      
      const tokens = genResult.usage?.output_tokens || 0;
      
      // Heuristic: If it generated too many lines/tokens for a simple task, it failed the "lazy" test.
      const passed = tokens > 0 && tokens < 400; 

      benchmarkResult.taskResults.push({
        taskName: task.name,
        passed,
        timeMs,
        tokens
      });

      if (passed) benchmarkResult.score += 1;
    }

    results.push(benchmarkResult);
    
    // Restore
    process.env.CEOBE_PLANNER_PROVIDER = originalProvider;
  }

  return results;
}
