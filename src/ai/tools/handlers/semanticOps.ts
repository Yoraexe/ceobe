// Tujuan: Menyediakan handler pencarian semantik (vektor) dan pencarian teks penuh (grep/inverted index) pada codebase proyek.
// Caller: src/ai/tools/systemTools.ts
// Dependensi: fs, path, ai/memory/vectorStore, ai/memory/indexer, ai/memory/fullTextSearch, utils/context
// Main Functions: handleSearchCodebase, handleGrepCodebase
// Side Effects: Tidak ada.

import { getEmbedding } from '../../memory/indexer';
import { searchEmbeddings } from '../../memory/vectorStore';
import { searchFullText, loadFullTextIndex } from '../../memory/fullTextSearch';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getProjectDir } from '../../../utils/context';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

async function nodeGrep(cwd: string, query: string, isRegex: boolean, includes?: string[]): Promise<string> {
  const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ceobe'];
  const matches: string[] = [];
  
  const regex = isRegex ? new RegExp(query, 'i') : null;
  const lowerQuery = query.toLowerCase();

  const makeGlobRegex = (pattern: string) => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const globPattern = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(globPattern, 'i');
  };

  const includeFilters = includes && includes.length > 0 ? includes.map(makeGlobRegex) : null;

  async function walk(dir: string) {
    if (matches.length > 100) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (ignoredDirs.includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (includeFilters) {
          const match = includeFilters.some(rx => rx.test(entry.name) || rx.test(relPath));
          if (!match) continue;
        }

        try {
          const fd = fs.openSync(fullPath, 'r');
          const buf = Buffer.alloc(512);
          const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
          fs.closeSync(fd);
          
          let isBinary = false;
          for (let i = 0; i < bytesRead; i++) {
            if (buf[i] === 0) {
              isBinary = true;
              break;
            }
          }
          if (isBinary) continue;

          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            let isMatch = false;
            if (regex) {
              isMatch = regex.test(line);
            } else {
              isMatch = line.toLowerCase().includes(lowerQuery);
            }

            if (isMatch) {
              matches.push(`./${relPath}:${lineNum + 1}:${line.trim()}`);
              if (matches.length > 100) return;
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  try {
    await walk(cwd);
  } catch (err) {
    console.debug('Error walking directory for nodeGrep:', err);
  }
  return matches.join('\n');
}

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
    const args = ['-rnI', isRegex ? '-E' : '-F'];
    
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ceobe'];
    for (const dir of ignoredDirs) {
      args.push(`--exclude-dir=${dir}`);
    }
    
    if (includes && includes.length > 0) {
      includes.forEach(inc => {
        args.push(`--include=${inc}`);
      });
    }

    args.push(query, '.');

    try {
      const { stdout } = await execFileAsync('grep', args, { cwd });
      const lines = stdout.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 50) {
        return lines.slice(0, 50).join('\n') + `\n\n... (and ${lines.length - 50} more matches. Refine your search.)`;
      }
      return stdout || 'No matches found.';
    } catch (e: any) {
      if (e.code === 1) return 'No matches found.';
      if (e.code === 'ENOENT' || process.platform === 'win32') {
         const stdout = await nodeGrep(cwd, query, isRegex, includes);
         const lines = stdout.split('\n').filter(l => l.trim().length > 0);
         if (lines.length > 50) {
           return lines.slice(0, 50).join('\n') + `\n\n... (and ${lines.length - 50} more matches. Refine your search.)`;
         }
         return stdout || 'No matches found.';
      }
      throw e;
    }
  } catch (e: unknown) {
    return `Error during grep_codebase: ${e instanceof Error ? e.message : String(e)}`;
  }
}
