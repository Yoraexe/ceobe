# Ceobe Mastery CLI 🚀

An autonomous AI Engineering orchestrator CLI. Trully Model-Agnostic: supports Gemini, Claude, and any OpenAI-compatible provider (DeepSeek, GLM, Groq, Ollama, etc.).

## 🧠 The "Three Brains" Architecture (v1.6.1+)
Ceobe now utilizes a **Three Brain Pattern** to prevent AI hallucinations and eliminate self-evaluation bias:
1. **Planner (The Architect)**: Reads your request and generates a strict Blueprint (BRD, Design, Architecture). Best paired with highly intelligent models (e.g., Claude 3.5 Sonnet or GPT-4o).
2. **QA Auditor (The Independent Reviewer)**: Strictly reviews the Planner's blueprint for logic gaps and contradictions *before* any code is written.
3. **Executor (The Programmer)**: Follows the validated blueprint to write the code. Best paired with fast/cheap models (e.g., Gemini 2.5 Flash, GLM, or Llama 3).

## ⚡ Features
- **Provider Agnostic:** Switch models instantly without touching the code.
- **Pre-Handoff Self-Correction:** Automatically detects and fixes lint/compilation errors during execution.
- **Dynamic Skill Routing:** Automatically equips specialized engineering skills (from 34+ available skills) based on your prompt.
- **Multi-Modal Support:** Pass `.md` files or even UI Mockup Images (`.png`, `.webp`) as your prompt!

## 📦 Installation

```bash
npm install -g ceobe-mastery-cli
```

## 🛠️ Configuration (CLI Wizard)

Configure your API keys and roles easily using the built-in CLI:

```bash
# 1. Set your API Keys
ceobe key set glm <YOUR_GLM_API_KEY>
ceobe key set gemini <YOUR_GEMINI_API_KEY>

# 2. Assign The Three Brains
ceobe key set planner-provider anthropic
ceobe key set qa-provider gemini
ceobe key set executor-provider glm

# 3. Verify your setup
ceobe doctor
```

## 📖 Usage Scenarios

### 1. Greenfield (New Projects)
Start a new project from scratch:
```bash
ceobe auto "Build a REST API with Go, Fiber, and PostgreSQL"
```

### 2. Brownfield (Adding Features)
Add features to an existing codebase without breaking it:
```bash
ceobe auto --feature "Add Stripe payment gateway integration to the checkout module"
```

### 3. Data-Driven (Documents & UI Mockups)
Pass a PRD or an image mockup:
```bash
# From a document
ceobe auto --file requirements.md

# From an image mockup
ceobe auto --file dashboard-mockup.png "Make this using React and Tailwind"
```

### 4. Human-in-the-Loop (Safe Mode)
Want to approve actions before Ceobe executes them?
```bash
# Set mode globally
ceobe mode ask

# Or bypass temporarily for one run
ceobe auto "Build a portfolio" --ask
```

## 🔍 Utilities
- `ceobe status` : Check the current phase of the pipeline.
- `ceobe log` : View the execution terminal logs.
- `ceobe reset --yes` : Clear all current plans and blueprints.

## 🤝 How to Contribute
Ceobe is designed to be infinitely expandable. You can add new Skills or Engineering Rules!
1. Fork this repository.
2. Add a new Markdown skill in the `skills/` folder.
3. Submit a Pull Request!

## 📜 License
[MIT](LICENSE)
