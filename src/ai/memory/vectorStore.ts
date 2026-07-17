// Tujuan: Mengelola penyimpanan dan pencarian vektor (embeddings) secara in-memory menggunakan Cosine Similarity.
// Caller: src/ai/memory/indexer.ts, src/ai/tools/systemTools.ts
// Dependensi: fs, path, config/env
// Main Functions: saveEmbeddings, loadEmbeddings, searchEmbeddings
// Side Effects: Read/write file system (.ceobe/embeddings.json)

import * as fs from 'fs';
import * as path from 'path';

export interface CodeChunk {
  id: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

import { getProjectDir } from '../../utils/context';

export function getEmbeddingsFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'embeddings.json');
}

export function saveEmbeddings(chunks: CodeChunk[]): void {
  const filePath = getEmbeddingsFilePath();
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = filePath + '.tmp.' + Math.random().toString(36).substring(2);
  fs.writeFileSync(tempPath, JSON.stringify(chunks, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
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
    console.debug(`[VectorStore Debug] Failed to load embeddings: ${error}`);
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

  // Verifikasi jika dimensi embedding berubah (karena pergantian model provider)
  if (chunks[0].embedding.length > 0 && chunks[0].embedding.length !== queryVector.length) {
    // Fix L-20: Prevent destructive unlinking. Just throw an error and let the user handle re-indexing if intended.
    throw new Error('Dimensi embedding tidak cocok (kemungkinan model provider berubah). Harap jalankan "ceobe index" ulang untuk memperbarui database.');
  }

  const results: SearchResult[] = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryVector, chunk.embedding)
  }));

  // Sort descending berdasarkan skor
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, topK);
}
