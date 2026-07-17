import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runBenchmarks } from '../../../ai/benchmark/benchmarkRunner';

export function registerBenchmarkCommand(program: Command): void {
  program
    .command('benchmark')
    .description('📊 Jalankan tes ketahanan model (LLM Benchmark) untuk membandingkan efisiensi arsitektur antar Provider.')
    .action(async () => {
      console.log(chalk.cyan('Memulai Ceobe Automated LLM Benchmark...\n'));
      
      const spinner = ora('Menjalankan test suite pada provider aktif (OpenAI, Anthropic, Gemini)...').start();
      
      try {
        const results = await runBenchmarks();
        
        spinner.succeed(chalk.green('Benchmark selesai!\n'));
        
        console.log(chalk.yellow('🏆 LEADERBOARD EFFICIENCY (Ceobe Ruleset)'));
        console.log('--------------------------------------------------');
        
        // Sort by score descending, then by total tokens ascending (efficiency), then time ascending
        results.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aTokens = a.taskResults.reduce((sum, r) => sum + r.tokens, 0);
          const bTokens = b.taskResults.reduce((sum, r) => sum + r.tokens, 0);
          if (aTokens !== bTokens) return aTokens - bTokens;
          const aTime = a.taskResults.reduce((sum, r) => sum + r.timeMs, 0);
          const bTime = b.taskResults.reduce((sum, r) => sum + r.timeMs, 0);
          return aTime - bTime;
        });

        results.forEach((res, index) => {
          console.log(chalk.bold(`${index + 1}. Model: ${res.model}`) + ` (Score: ${res.score}/${res.taskResults.length})`);
          let totalTime = 0;
          let totalTokens = 0;
          
          res.taskResults.forEach(tr => {
            const status = tr.passed ? chalk.green('PASS') : chalk.red('FAIL (Over-engineered)');
            console.log(`   - ${tr.taskName}: ${status} | ${tr.tokens} tokens | ${tr.timeMs}ms`);
            totalTime += tr.timeMs;
            totalTokens += tr.tokens;
          });
          
          console.log(chalk.gray(`   > Total: ${totalTokens} tokens, ${totalTime}ms\n`));
        });
        
      } catch (err: any) {
        spinner.fail(chalk.red(`Gagal menjalankan benchmark: ${err.message}`));
      }
    });
}
