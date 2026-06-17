# Ceobe Mastery CLI 🚀 [V3 Engine]

An autonomous AI Engineering orchestrator CLI. Trully Model-Agnostic: supports Gemini, Claude, and any OpenAI-compatible provider (DeepSeek, GLM, Groq, Ollama, etc.).

## 🧠 The "Three Brains" Architecture (v1.6.1+)
Ceobe now utilizes a **Three Brain Pattern** to prevent AI hallucinations and eliminate self-evaluation bias:
1. **Planner (The Architect)**: Reads your request and generates a strict Blueprint (BRD, Design, Architecture). Best paired with highly intelligent models (e.g., Claude 4.5 Sonnet or GPT-4o).
2. **QA Auditor (The Reviewer)**: Strictly reviews the Blueprint against the core rules to ensure architectural soundness.
3. **Executor (The Programmer)**: Follows the validated blueprint to write the code. Best paired with fast/cheap models (e.g., Gemini Exp, GLM, or Llama 3).

## ⚡ Features (v1.13.0 V3 Engine)
- **🔥 Hash Convergence Guard (V3 New):** Infinite-loop protection! Supervisor tracks document state via SHA-256 hashes and gracefully skips QA audits if no documents were changed, saving thousands of tokens and eliminating loop traps.
- **🛡️ Token Bleed Protection (V3 New):** Executor now detects `max_tokens` exhaustion and breaks loops safely after 3 retries, preventing run-away token burn.
- **🎯 Dynamic Tool Injection (V3 New):** The system intelligently parses your task and *only* injects the required LLM skills/tools into the prompt, resulting in massive Input Token reduction.
- **✨ Prefix Caching Support (V3 New):** Fully typed `NormalizedContentBlock` support enables 100% compatibility with Anthropic's `cache_control: true` feature, dramatically speeding up audits and reducing prompt token costs.
- **🛠️ Core Stability & Type Safety (v1.13.0 New):** Fixed all audit warnings, eliminated implicit 'any' types, and implemented graceful queue shutdown (`waitUntilDrained`) for Telegram Daemon.
- **🌐 Polyglot Architecture Check (v1.12.0 New):** Automatically detects and verifies compilations/tests across TypeScript, Go, Rust, PHP/Laravel, and Python after each execution wave.
- **🛡️ Telegram Interactive HITL (v1.12.0 New):** Safe mode `mode ask` now streams confirmation requests directly to your Telegram with interactive Inline Buttons (Approve/Reject).
- **🔐 Concurrent File-Lock Safety:** Rock-solid thread safety for multi-agent I/O. File writes are protected with `proper-lockfile` and strict mutex-like write locks, eliminating corruption even when 10 AI subagents write simultaneously!
- **🌐 Strict Context Isolation (New):** Fully supports Multi-Tenancy for the Telegram Daemon. Each Telegram user session has strict project boundaries and dynamic path resolution (`executionContext`), eliminating path traversal vulnerabilities.
- **📱 Telegram Remote Daemon:** Command and monitor your AI orchestration fully from your mobile phone! Includes multi-project session management (`/cd`, `/addproject`) and remote file viewing (`/read`).
- **🛡️ Interactive Human-In-The-Loop (HITL):** Approve or reject dangerous commands and file deletions directly via Telegram Inline Buttons.
- **🧩 Dynamic Plugin System:** Inject custom behaviors and tools into the agent by simply dropping `.ts` scripts into `.ceobe/plugins/`. No core modifications needed!
- **⚡ Multi-Agent Parallel Execution:** The Supervisor intelligently groups independent tasks into "Waves" and executes them concurrently for blazingly fast delivery.
- **⏪ Git Auto-Snapshot & Rollback:** Automatically creates snapshots before AI execution. If post-execution auto-healing fails after max retries, Ceobe automatically rolls back the codebase to safety.
- **💰 Live Cost Tracking:** Real-time token usage and API cost monitoring per session (`/cost`).
- **🌐 Provider Agnostic:** Switch models instantly (Anthropic, Gemini, OpenAI, GLM).
- **👁️ Multi-Modal Support:** Pass `.md` files or UI Mockup Images (`.png`, `.webp`) as your prompt!

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

### 5. Telegram Daemon (Remote Mobile Control)
Run Ceobe on a server/laptop and control it securely from your phone!
```bash
# 1. Setup your keys
ceobe key set telegram-token <YOUR_BOT_TOKEN>
ceobe key set telegram-allowed-users <YOUR_TELEGRAM_USER_ID>

# 2. Start the Daemon
ceobe daemon --telegram
```
**In Telegram, simply type:**
- `/projects` and `/addproject <name> <path>` to manage workspaces.
- `/cd <name>` to seamlessly switch contexts.
- `/mode <ask|autonomous>` or just `/ask` and `/auto` to toggle between HITL confirmation and full autonomy.
- `/cost` and `/status` to track execution metrics.
- `/logs` to tail the recent terminal logs.
- `/cancel` to clear the task queue.
- Use `/read <file>` to fetch the generated design document or any source code.
- Send a prompt: *"Tolong buatkan halaman login..."*
- Approve/Reject dangerous commands (`mode ask`) directly using Interactive Buttons!

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
