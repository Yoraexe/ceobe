// Module: src/ai/taskParser.ts
// Tujuan: Menganalisis task plan markdown dan mengelompokkan task menjadi
//         "gelombang eksekusi" berurutan. Task independen dalam satu gelombang
//         dapat dieksekusi secara paralel; task dependen dieksekusi berurutan.
// Caller: src/ai/supervisor.ts
// Dependensi: -
// Main Functions: parseTaskWaves, TaskWave
// Side Effects: Tidak ada I/O. Pure function, hanya parsing string.
// v1.7.0: Modul baru — Fase 6 dari Ceobe Enterprise Upgrade (Multi-Agent Parallel Execution).

interface TaskItem {
  id: string;
  title: string;
  content: string;
}

export interface TaskWave {
  /** Wave index (0 = first to execute). */
  wave: number;
  /** Tasks in this wave that can run in parallel. */
  tasks: TaskItem[];
}

/**
 * Detects dependency keywords in a task description.
 * Returns true if the task clearly depends on a previous step.
 */
function hasDependencyKeyword(text: string): boolean {
  const DEPENDENCY_SIGNALS = [
    'requires task', 'depends on', 'using the module', 'based on task',
    'integrate with', 'connect to the', 'import from', 'use the service',
    'after completing', 'after the', 'when the task', 'dependent on',
    'setelah task', 'setelah selesai', 'membutuhkan', 'bergantung pada', 'integrasi dengan',
  ];
  return DEPENDENCY_SIGNALS.some(sig => new RegExp(`(?:^|\\s)${sig.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\$&')}(?=\\s|$)`, 'i').test(text));
}

/**
 * Detects tasks that are always safe to run in parallel (no code dependencies).
 */
function isAlwaysParallel(text: string): boolean {
  const INDEPENDENT_SIGNALS = [
    'documentation', 'readme', 'dockerfile', 'docker-compose',
    '.gitignore', 'license', 'env.example', '.env.example',
    'write unit test', 'add unit test', 'unit tests', 'write test', 'add test',
    'dokumentasi', 'dokumen', 'tulis test',
  ];
  return INDEPENDENT_SIGNALS.some(sig => new RegExp(`(?:^|\\s)${sig.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\$&')}(?=\\s|$)`, 'i').test(text));
}

/**
 * Parses a Ceobe task plan markdown file into execution waves.
 *
 * Wave assignment logic:
 * - Wave 0: Foundation tasks (schema, database setup, project scaffolding).
 * - Wave N: Tasks with dependency keywords go after tasks without them.
 * - Tasks marked as "always parallel" (docs, tests, infra) go in the last wave.
 *
 * This is a heuristic parser — not AST-based — so it is intentionally
 * conservative: when in doubt, it assigns a task to a later wave rather than
 * running it in parallel.
 *
 * @param taskMarkdown  Raw content of .ceobe/task.md
 * @returns Array of TaskWave objects ordered by execution sequence.
 */
export function parseTaskWaves(taskMarkdown: string): TaskWave[] {
  // Split on markdown heading patterns (## Task, ### Step, - [ ] item, numbered lists)
  const rawTasks = taskMarkdown
    .split(/\n(?=#{1,3}\s|\d+\.\s|\-\s\[)/)
    .map(block => block.trim())
    .filter(block => block.length > 10); // Skip empty / very short blocks

  if (rawTasks.length === 0) {
    // No structured tasks found — treat entire plan as a single task
    return [{
      wave: 0,
      tasks: [{ id: 'task-0', title: 'Full Plan', content: taskMarkdown }]
    }];
  }

  const tasks: TaskItem[] = rawTasks.map((block, i) => {
    const titleLine = block.split('\n')[0].replace(/^[#\-\[\] ]+/, '').trim();
    return {
      id: `task-${i}`,
      title: titleLine || `Task ${i}`,
      content: block,
    };
  });

  // ── Heuristic wave assignment ──────────────────────────────────────────────
  // Wave 0: Foundation (DB, schema, project init, config)
  // Wave 1: Core business logic (services, repositories, controllers)
  // Wave 2: Integration layer (API routes, frontend connection)
  // Wave 3: Parallel wrap-up (tests, docs, infra, CI/CD)

  const FOUNDATION_SIGNALS = [
    'schema', 'database', 'migration', 'prisma', 'drizzle', 'sequelize',
    'scaffold', 'init', 'setup', 'install', 'package.json', 'tsconfig',
    'create project', 'project structure', 'folder structure', 'buat project',
    'inisialisasi', 'setup awal',
  ];

  const CORE_SIGNALS = [
    'service', 'repository', 'model', 'entity', 'domain',
    'business logic', 'use case', 'handler', 'controller',
    'layanan', 'repositori',
  ];

  const INTEGRATION_SIGNALS = [
    'route', 'api', 'endpoint', 'frontend', 'component', 'page', 'ui',
    'connect', 'middleware', 'auth', 'authentication', 'authorization',
    'rute', 'halaman',
  ];

  const categorize = (task: TaskItem): number => {
    const lower = (task.title + ' ' + task.content).toLowerCase();
    if (isAlwaysParallel(lower)) return 3;
    if (hasDependencyKeyword(lower)) {
      if (INTEGRATION_SIGNALS.some(s => lower.includes(s))) return 2;
      return 1;
    }
    if (FOUNDATION_SIGNALS.some(s => lower.includes(s))) return 0;
    if (CORE_SIGNALS.some(s => lower.includes(s))) return 1;
    if (INTEGRATION_SIGNALS.some(s => lower.includes(s))) return 2;
    return 1; // Default: core layer
  };

  // Group by wave
  const waveMap = new Map<number, TaskItem[]>();
  for (const task of tasks) {
    const waveIndex = categorize(task);
    if (!waveMap.has(waveIndex)) waveMap.set(waveIndex, []);
    waveMap.get(waveIndex)!.push(task);
  }

  // Sort waves and return
  const waves: TaskWave[] = Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([wave, waveTasks]) => ({ wave, tasks: waveTasks }));

  return waves;
}
