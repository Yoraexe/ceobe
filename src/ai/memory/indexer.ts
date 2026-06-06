// Tujuan: Membaca seluruh file di workspace, memecah kode menjadi chunks, dan membuat embeddings.
// Caller: src/index.ts (atau perintah CLI `ceobe index`)
// Dependensi: fs, path, vectorStore, env, ora, chalk, astParser
// Main Functions: indexWorkspace, getEmbedding
// Side Effects: Read files, call Google API, write to embeddings.json
// v1.7.0: AST Context Compression — file TypeScript besar dikompresi ke signature-only
//         sebelum di-embedding, mengurangi token usage hingga ~80%.

import * as fs from 'fs';
import * as path from 'path';

import { createEmbeddingAdapter } from '../providers/embeddingAdapter';
import { saveEmbeddings, CodeChunk, loadEmbeddings } from './vectorStore';
import { getProjectDir } from '../../utils/context';
import chalk from 'chalk';
import ora from 'ora';
import { extractTypeScriptSignatures, isTypeScriptFile, AST_COMPRESSION_THRESHOLD } from './astParser';

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ceobe'];
const IGNORED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.pdf', '.zip', '.tar', '.gz'];

// Limit to 300 lines per chunk to maintain context quality
const CHUNK_LINE_LIMIT = 300;
const EMBEDDING_BATCH_SIZE = 5;

interface FileCache {
  [filePath: string]: number; // Store mtimeMs
}

function getCacheFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'indexer-cache.json');
}

function loadCache(): FileCache {
  const cachePath = getCacheFilePath();
  if (fs.existsSync(cachePath)) {
    try {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveCache(cache: FileCache): void {
  const cachePath = getCacheFilePath();
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (IGNORED_DIRS.includes(file)) continue;
    
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (!IGNORED_EXTS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

let cachedEmbeddingAdapter: ReturnType<typeof createEmbeddingAdapter> | null = null;

export async function getEmbedding(text: string): Promise<number[]> {
  if (!cachedEmbeddingAdapter) {
    cachedEmbeddingAdapter = createEmbeddingAdapter();
  }
  return cachedEmbeddingAdapter.getEmbedding(text);
}

export async function indexWorkspace(): Promise<void> {
  const workspaceRoot = path.resolve(getProjectDir());
  const spinner = ora('Scanning workspace files...').start();
  
  try {
    const files = getAllFiles(workspaceRoot);
    const cache = loadCache();
    const existingEmbeddings = loadEmbeddings();
    
    const filesToProcess: string[] = [];
    const newCache: FileCache = {};
    const finalChunks: CodeChunk[] = [];
    
    // Determine which files changed
    for (const file of files) {
      const stat = fs.statSync(file);
      const mtime = stat.mtimeMs;
      const relPath = path.relative(workspaceRoot, file);
      
      newCache[relPath] = mtime;
      
      if (!cache[relPath] || cache[relPath] !== mtime) {
        filesToProcess.push(file);
      } else {
        // Keep existing embeddings for this file
        const fileChunks = existingEmbeddings.filter(c => c.filePath === relPath);
        finalChunks.push(...fileChunks);
      }
    }
    
    if (filesToProcess.length === 0) {
      spinner.succeed(chalk.green('Workspace is up to date. No new indexing required.'));
      // Still save cache in case files were deleted
      saveCache(newCache);
      saveEmbeddings(finalChunks); // Clean up embeddings of deleted files
      return;
    }
    
    spinner.text = `Found ${filesToProcess.length} modified/new files. Creating chunks...`;
    const chunks: Omit<CodeChunk, 'embedding'>[] = [];
    
    for (const file of filesToProcess) {
      try {
        const stats = fs.statSync(file);
        if (stats.size > 1000000) continue; // Skip files > 1MB

        const rawContent = fs.readFileSync(file, 'utf8');
        const lines = rawContent.split('\n');
        const relPath = path.relative(workspaceRoot, file);

        // ── AST Context Compression ─────────────────────────────────────────────────
        // Large TypeScript files are compressed to signature-only representation
        // before embedding. This keeps token usage per chunk minimal while
        // preserving 100% of structural/navigational information.
        let content: string;
        let compressed = false;
        if (isTypeScriptFile(file) && lines.length >= AST_COMPRESSION_THRESHOLD) {
          content = extractTypeScriptSignatures(rawContent, relPath);
          compressed = true;
        } else {
          content = rawContent;
        }
        // ─────────────────────────────────────────────────────────────────────

        const contentLines = content.split('\n');
        let currentChunk = '';
        let chunkIndex = 0;
        let lineCount = 0;

        for (let i = 0; i < contentLines.length; i++) {
          currentChunk += contentLines[i] + '\n';
          lineCount++;

          if (lineCount >= CHUNK_LINE_LIMIT || i === contentLines.length - 1) {
            chunks.push({
              id: `${relPath}-${chunkIndex}${compressed ? '-ast' : ''}`,
              filePath: relPath,
              chunkIndex,
              content: currentChunk.trim()
            });
            currentChunk = '';
            lineCount = 0;
            chunkIndex++;
          }
        }
      } catch (err) {
        // Skip binary files or unreadable files
      }
    }
    
    spinner.text = `Processing ${chunks.length} chunks via Gemini Embeddings (batch size: ${EMBEDDING_BATCH_SIZE})...`;
    
    let processed = 0;
    
    // Process in batches for performance
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE).filter(c => c.content);
      
      const results = await Promise.allSettled(
        batch.map(chunk => getEmbedding(`File: ${chunk.filePath}\n\n${chunk.content}`))
      );
      
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value.length > 0) {
          finalChunks.push({
            ...batch[j],
            embedding: result.value
          });
        }
      }
      
      processed += batch.length;
      spinner.text = `Embedding chunk ${processed}/${chunks.length}...`;
    }
    
    saveEmbeddings(finalChunks);
    saveCache(newCache);
    spinner.succeed(chalk.green(`Successfully indexed ${chunks.length} new/modified chunks. Total chunks in memory: ${finalChunks.length}.`));
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`Indexing failed: ${msg}`));
    throw error;
  }
}
