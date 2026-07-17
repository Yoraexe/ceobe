// Tujuan: Mengelola penyimpanan dan pencarian full-text (inverted index) secara in-memory.
// Caller: src/ai/memory/indexer.ts, src/ai/tools/systemTools.ts
// Dependensi: fs, path, utils/context

import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir } from '../../utils/context';

export interface FullTextIndex {
  [token: string]: Array<{ filePath: string; line: number; }>;
}

export interface SearchResult {
  filePath: string;
  line: number;
  score: number;
}

function getFullTextIndexFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'fulltext-index.json');
}

export function saveFullTextIndex(index: FullTextIndex): void {
  const filePath = getFullTextIndexFilePath();
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = filePath + '.tmp.' + Math.random().toString(36).substring(2);
  fs.writeFileSync(tempPath, JSON.stringify(index), 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function loadFullTextIndex(): FullTextIndex {
  const filePath = getFullTextIndexFilePath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.debug(`[FullTextSearch Debug] Failed to load fulltext index: ${error}`);
    return {};
  }
}

function tokenize(text: string): string[] {
  // Split by non-alphanumeric, keep parts. Convert to lowercase.
  return text.split(/[^a-zA-Z0-9_]+/)
    .map(t => t.toLowerCase())
    .filter(t => t.length > 2); // Ignore very short tokens
}

// Function to index a single file's content
export function indexFileContent(filePath: string, content: string, index: FullTextIndex): void {
  const lines = content.split('\n');
  const seen = new Set<string>(); // to avoid duplicate lines for the same token
  
  for (let i = 0; i < lines.length; i++) {
    const tokens = tokenize(lines[i]);
    for (const token of tokens) {
      const key = `${token}:${filePath}:${i+1}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (!index[token]) index[token] = [];
        index[token].push({ filePath, line: i + 1 });
      }
    }
  }
}

export function removeFileFromIndex(filePath: string, index: FullTextIndex): void {
  for (const token in index) {
    index[token] = index[token].filter(entry => entry.filePath !== filePath);
    if (index[token].length === 0) {
      delete index[token];
    }
  }
}

export function searchFullText(query: string, index: FullTextIndex, topK: number = 20): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scores = new Map<string, { filePath: string; line: number; matchCount: number }>();

  // Simple TF-like scoring: 
  for (const qToken of queryTokens) {
    for (const token in index) {
      if (qToken.length < 3 && token !== qToken) continue; // Fix H-16: Prevent DoS from short substring queries
      if (token.includes(qToken)) { // exact or substring
        for (const entry of index[token]) {
          const key = `${entry.filePath}:${entry.line}`;
          const current = scores.get(key) || { filePath: entry.filePath, line: entry.line, matchCount: 0 };
          current.matchCount += (token === qToken ? 2 : 1); // Exact match gets higher score
          scores.set(key, current);
        }
      }
    }
  }

  const results: SearchResult[] = Array.from(scores.values()).map(s => ({
    filePath: s.filePath,
    line: s.line,
    score: s.matchCount
  }));

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
