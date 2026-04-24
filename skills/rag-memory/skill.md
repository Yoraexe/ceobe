# Skill: Retrieval-Augmented Generation (RAG) Memory

## 1. Description
Ceobe's Long-Term Memory Protocol. Used to overcome LLM context window limits when dealing with enterprise codebases (>100 files).

## 2. Trigger
Whenever Ceobe enters a Brownfield project with a large directory structure, or when navigating an existing architecture that exceeds token limits.

## 3. Rules & Execution
1. **Never load the entire codebase into context.**
2. **Index Generation:** On initial entry, trigger a semantic indexing of the source code.
3. **Semantic Search:** When tasked with modifying a specific feature (e.g., "Add email verification"), use RAG to query the codebase semantically (`query: "email sending logic"` or `query: "auth controller"`).
4. **Context Injection:** Only inject the top 3-5 most relevant files/snippets returned by the vector search into the active context window.
5. **Trace Update:** After modifying code, update the specific vector embeddings for the modified files to ensure the memory stays fresh.
