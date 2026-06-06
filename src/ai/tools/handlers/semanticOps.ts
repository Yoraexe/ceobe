import { getEmbedding } from '../../memory/indexer';
import { searchEmbeddings } from '../../memory/vectorStore';

export async function handleSemanticSearch(input: Record<string, any>): Promise<string> {
  try {
    const queryVector = await getEmbedding(input.query);
    if (queryVector.length === 0) return 'Error: Failed to generate embedding for query.';
    
    const results = searchEmbeddings(queryVector, 5);
    if (results.length === 0) return 'No relevant code found in memory. Please ensure the workspace has been indexed.';
    
    return results.map(r => `--- File: ${r.chunk.filePath} (Relevance Score: ${r.score.toFixed(3)}) ---\n${r.chunk.content}`).join('\n\n');
  } catch (e: unknown) {
    return `Error during semantic search: ${e instanceof Error ? e.message : String(e)}`;
  }
}
