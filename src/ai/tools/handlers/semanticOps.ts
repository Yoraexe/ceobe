import { getEmbedding } from '../../memory/indexer';
import { searchEmbeddings } from '../../memory/vectorStore';
import { searchFullText, loadFullTextIndex } from '../../memory/fullTextSearch';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getProjectDir } from '../../../utils/context';

const execAsync = promisify(exec);


export async function handleSearchCodebase(input: Record<string, any>): Promise<string> {
  try {
    const query = input.query as string;
    const topK = 10;
    
    // 1. Vector Search
    let vectorResults: Array<{ filePath: string, content: string, score: number }> = [];
    try {
      const queryVector = await getEmbedding(query);
      if (queryVector.length > 0) {
        vectorResults = searchEmbeddings(queryVector, topK * 2).map(r => ({
          filePath: r.chunk.filePath,
          content: r.chunk.content,
          score: r.score
        }));
      }
    } catch (e) {
      console.debug('Vector search failed:', e);
    }
    
    // 2. Full-Text Search
    const fullTextIndex = loadFullTextIndex();
    const keywordResults = searchFullText(query, fullTextIndex, topK * 2);
    
    // RRF (Reciprocal Rank Fusion)
    const k = 60;
    const rrfScores = new Map<string, number>();
    const contentMap = new Map<string, string>();
    
    // Rank Vector Results
    vectorResults.forEach((res, rank) => {
      rrfScores.set(res.filePath, 1 / (k + rank));
      contentMap.set(res.filePath, res.content);
    });
    
    // Rank Keyword Results
    keywordResults.forEach((res, rank) => {
      const currentScore = rrfScores.get(res.filePath) || 0;
      rrfScores.set(res.filePath, currentScore + (1 / (k + rank)));
      if (!contentMap.has(res.filePath)) {
         contentMap.set(res.filePath, `(Keyword match at line ${res.line})`);
      }
    });
    
    // Sort and Take Top K
    const merged = Array.from(rrfScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([filePath, score]) => {
        return `--- File: ${filePath} (RRF Score: ${score.toFixed(4)}) ---\n${contentMap.get(filePath)}`;
      });
      
    if (merged.length === 0) return 'No relevant code found.';
    return merged.join('\n\n');
  } catch (e: unknown) {
    return `Error during search_codebase: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function handleGrepCodebase(input: Record<string, any>): Promise<string> {
  const query = input.query as string;
  const isRegex = input.isRegex || false;
  const includes = input.includes as string[] | undefined;
  
  try {
    const cwd = getProjectDir();
    let cmd = `grep -rnI ${isRegex ? '-E' : '-F'} "${query.replace(/"/g, '\\"')}" .`;
    
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ceobe'];
    for (const dir of ignoredDirs) {
      cmd += ` --exclude-dir="${dir}"`;
    }
    
    if (includes && includes.length > 0) {
      includes.forEach(inc => {
        cmd += ` --include="${inc}"`;
      });
    }

    try {
      const { stdout } = await execAsync(cmd, { cwd });
      const lines = stdout.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 50) {
        return lines.slice(0, 50).join('\n') + `\n\n... (and ${lines.length - 50} more matches. Refine your search.)`;
      }
      return stdout || 'No matches found.';
    } catch (e: any) {
      if (e.code === 1) return 'No matches found.';
      throw e;
    }
  } catch (e: unknown) {
    return `Error during grep_codebase: ${e instanceof Error ? e.message : String(e)}`;
  }
}
