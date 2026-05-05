# Ceobe Mastery CLI 🚀

An autonomous AI Engineering orchestrator CLI. Trully Model-Agnostic: supports Gemini, Claude, and any OpenAI-compatible provider (DeepSeek, GLM, Groq, Ollama, etc.).

## Features
- **Unified Provider Router:** Switch models (Gemini, Claude, DeepSeek, etc.) via `.env` without changing code.
- **Interactive Browser Interaction:** Ceobe can now "see" and "act" in a browser (click, type, scroll) to perform automated E2E testing and visual audits.
- **Structured Pipeline:** 5-Phase autonomous loop (BRD -> Design -> Arch -> Task -> Execute).
- **Codebase Memory:** RAG-based semantic search for large project context.
- **Code Correction Loop:** Automatically detects and fixes build/test errors during execution.
- **Autonomous & Human-in-the-Loop:** Run full projects on autopilot or intervene at every step.
- **Dynamic Skill Routing:** Equipped with 34+ specialized engineering skills.

## Installation

```bash
npm install -g ceobe-mastery-cli
```

### Environment Variables
Configure your system or a local `.env` file. Ceobe is highly flexible:

```env
# Role Selection (Optional, defaults are Gemini for Planning, Claude for Execution)
CEOBE_PLANNER_PROVIDER=gemini
CEOBE_EXECUTOR_PROVIDER=claude

# API Keys (Convention: {PROVIDER_NAME}_API_KEY)
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
GLM_API_KEY=...
```

## How to Contribute
Ceobe is designed to be infinitely expandable. You can add new Skills or Engineering Rules!

1. Fork this repository.
2. Add a new Markdown skill in the `skills/` folder.
3. Submit a Pull Request!

## License
[MIT](LICENSE)
