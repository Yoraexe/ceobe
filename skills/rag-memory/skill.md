# Skill: Retrieval-Augmented Generation (RAG) Memory

## 1. Description
Ceobe's Long-Term Memory Protocol. Used to overcome LLM context window limits when dealing with enterprise codebases (>100 files).

## 2. Trigger
Whenever Ceobe enters a Brownfield project with a large directory structure, or when navigating an existing architecture that exceeds token limits.

## 3. Architecture Reference
This skill is implemented by three source modules:
- **Indexer:** `src/ai/memory/indexer.ts` — Walks the workspace, splits files into 300-line chunks, and generates embeddings via Gemini `text-embedding-004`. Uses `mtimeMs` caching to skip unchanged files (incremental indexing).
- **Vector Store:** `src/ai/memory/vectorStore.ts` — Stores embeddings as JSON at `.ceobe/embeddings.json`. Implements cosine similarity search to find the top-K most relevant code chunks for any natural language query.
- **Semantic Search Tool:** `src/ai/tools/systemTools.ts` — the `semantic_search` tool (lines 251-263) exposes RAG to Claude. Claude calls it with a natural language query, and receives the top 5 most relevant code snippets with file paths and relevance scores.

## 4. Rules & Execution
1. **Never load the entire codebase into context.** Token budgets are finite.
2. **Index Generation:** On initial entry, the Supervisor triggers `indexWorkspace()` before execution.
3. **Incremental Updates:** After modifying files, re-index only changed files using the `mtimeMs` cache at `.ceobe/indexer-cache.json`.
4. **Semantic Search:** When tasked with modifying a specific feature (e.g., "Add email verification"), use the `semantic_search` tool with conceptual queries:
   - ✅ Good: `"email sending logic"`, `"authentication controller"`, `"database connection pool"`
   - ❌ Bad: `"email"`, `"auth"`, `"db"` (too vague, low recall)
5. **Context Injection:** Only inject the top 3-5 most relevant files/snippets returned by the vector search into the active context window.
6. **Embedding Quality:** Always prefix chunk content with `File: <path>` when generating embeddings so the model understands file boundaries.

## 5. Anti-Patterns
- ❌ Never re-embed the entire workspace on every run — use incremental indexing.
- ❌ Never use keyword-only search (`search_in_files`) when you need semantic understanding — use `semantic_search` instead.
- ❌ Never store embeddings in memory only — always persist to `.ceobe/embeddings.json` for crash recovery.
