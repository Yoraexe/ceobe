// Tujuan: Mengelola penyimpanan dan pencarian vektor (embeddings) secara in-memory menggunakan Cosine Similarity.
// Caller: src/ai/memory/indexer.ts, src/ai/tools/systemTools.ts
// Dependensi: fs, path, config/env
// Main Functions: saveEmbeddings, loadEmbeddings, searchEmbeddings
// Side Effects: Read/write file system (.ceobe/embeddings.json)

import * as fs from 'fs';
import * as path from 'path';
import { env } from '../../config/env';

export interface CodeChunk {
  id: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export function getEmbeddingsFilePath(): string {
  return path.join(env.TARGET_PROJECT_DIR, '.ceobe', 'embeddings.json');
}

export function saveEmbeddings(chunks: CodeChunk[]): void {
  const filePath = getEmbeddingsFilePath();
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(chunks, null, 2), 'utf8');
}

export function loadEmbeddings(): CodeChunk[] {
  const filePath = getEmbeddingsFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

/**
 * Menghitung nilai kedekatan antara dua vektor (Cosine Similarity).
 * Semakin mendekati 1.0, semakin mirip secara semantik.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

/**
 * Mencari snippet kode yang paling relevan berdasarkan vektor query.
 * @param queryVector Vektor hasil embedding dari pertanyaan user
 * @param topK Jumlah hasil maksimal yang dikembalikan
 */
export function searchEmbeddings(queryVector: number[], topK: number = 5): SearchResult[] {
  const chunks = loadEmbeddings();
  if (chunks.length === 0) return [];

  const results: SearchResult[] = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryVector, chunk.embedding)
  }));

  // Sort descending berdasarkan skor
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, topK);
}
