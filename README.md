<div align="center">

```
  ░█████╗░███████╗░█████╗░██████╗░███████╗
  ██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝
  ██║░░╚═╝█████╗░░██║░░██║██████╦╝█████╗░░
  ██║░░██╗██╔══╝░░██║░░██║██╔══██╗██╔══╝░░
  ╚█████╔╝███████╗╚█████╔╝██████╦╝███████╗
  ░╚════╝░╚══════╝░╚════╝░╚═════╝░╚══════╝
```

**Autonomous AI Engineering Orchestrator**

`v1.17.0` · `Three Brains Architecture` · `Model-Agnostic` · `MIT`

[![npm](https://img.shields.io/npm/v/ceobe-mastery-cli?color=4FC3D9&label=npm&style=flat-square)](https://www.npmjs.com/package/ceobe-mastery-cli)
[![license](https://img.shields.io/github/license/Yoraexe/ceobe?color=6DCEA8&style=flat-square)](LICENSE)
[![providers](https://img.shields.io/badge/providers-10%2B-A78FD4?style=flat-square)](#-ai-providers)
[![skills](https://img.shields.io/badge/skills-288-F5C866?style=flat-square)](#-skills-library--288-skills)

</div>

---

## What is Ceobe?

Ceobe is a **CLI-native AI Engineering Orchestrator** that takes a description, image mockup, or PRD document — and produces a fully working codebase.

It is not a chat assistant. It is a **pipeline**.

```
  𝙿lanner → QA Auditor → 𝙴xecutor
```

Three independent AI brains, each with a separate provider, review each other's work before any code is written. The result is structured, architecture-compliant software — not hallucinated boilerplate.

---

## Three Brains Architecture

| Brain | Role | Best Model |
|---|---|---|
| **Planner** | Generates BRD → Design → Architecture → Task Plan | Claude Sonnet, GPT-4o |
| **QA Auditor** | Reviews blueprint against 18 engineering rules | Gemini 2.5 Flash, DeepSeek |
| **Executor** | Writes the code from the validated plan | GLM-5.1, Kimi-K2, Llama 3 |

Using three *different* providers prevents self-evaluation bias and catches hallucinations early.

---

## Installation

```bash
npm install -g ceobe-mastery-cli
```

## Quick Start

```bash
# 1. Configure providers
ceobe setup

# 2. Build something
ceobe auto "Build a REST API with Go, Fiber, and PostgreSQL"

# 3. Add a feature to an existing project
ceobe auto --feature "Add Stripe payment gateway integration"

# 4. From a PRD document
ceobe auto --file requirements.md

# 5. From a UI mockup image
ceobe auto --file dashboard.png "Use Next.js + Tailwind"
```

---

## Configuration

```bash
# API Keys
ceobe key set gemini         <GEMINI_API_KEY>
ceobe key set anthropic      <ANTHROPIC_API_KEY>
ceobe key set glm            <GLM_API_KEY>

# Assign roles to providers
ceobe key set planner-provider   anthropic
ceobe key set qa-provider        gemini
ceobe key set executor-provider  glm

# Optional: model overrides
ceobe key set planner-model  claude-4-5-sonnet
ceobe key set executor-model glm-5.1-flash

# Verify setup
ceobe doctor
```

**Key storage priority** (highest → lowest):
1. System environment variable (`export KEY=...`)
2. `~/.ceobe/keys.json` (via `ceobe key set`)
3. `.env` file in project directory

---

## AI Providers

| Slug | Provider | Default Model |
|---|---|---|
| `gemini` | Google Gemini | `gemini-2.5-flash` |
| `anthropic` | Anthropic Claude | `claude-4-5-sonnet` |
| `glm` | Zhipu AI | `glm-5.1-flash` |
| `kimi` | Moonshot AI | `kimi-k2.6-plus` |
| `deepseek` | DeepSeek | `deepseek-v3` |
| `groq` | Groq | `llama-3.3-70b-versatile` |
| `openai` | OpenAI | `gpt-4o` |
| `qwen` | Alibaba | `qwen-3-max` |
| `together` | Together AI | `llama-3.1-70B` |
| `ollama` | Local | `llama3.2` *(no key)* |
| *custom* | Any OpenAI-compatible | — |

For custom providers:
```bash
CEOBE_PLANNER_BASE_URL=https://my-api.example.com/v1
CEOBE_PLANNER_API_KEY=sk-...
```

Optional Cloudflare AI Gateway routing: set `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID`.

---

## CLI Reference

### Core

```bash
ceobe auto [desc]          # Full pipeline: plan → audit → execute
ceobe plan [desc]          # Generate plan only (no execution)
ceobe audit                # QA-review the generated plan against engineering rules
ceobe execute              # Execute an existing approved plan
ceobe export-rules         # Sync rules to Cursor / Windsurf / Cline / Antigravity
```

**`ceobe auto` flags:**

| Flag | Description |
|---|---|
| `--ask` | Human-in-the-loop — confirm before each destructive action |
| `--feature` | Brownfield mode — add to existing codebase without breaking it |
| `--file <path>` | Use a `.md` PRD or `.png/.webp` mockup as requirements |
| `--sandbox` | Isolate AI execution inside a Docker container |
| `--worktree` | Run in an isolated git worktree, merge on success |
| `--creative` | Bypass Ponytail Ladder — allow over-engineered exploration |

### Workspace

```bash
ceobe status               # Pipeline progress, phases & generated files
ceobe index                # Build semantic memory index (RAG) for workspace
ceobe trim                 # Whole-repo bloat scan — detect over-engineering
ceobe debt                 # Scan tech-debt markers (// ceobe: / // ponytail:)
ceobe reflect [--auto-skill] # Analyze logs, auto-generate skill draft
ceobe rollback             # Hard-reset to pre-AI git snapshot
ceobe reset --yes          # Clear all plans & state
ceobe recon <url>          # Dynamic reverse-engineering of a URL
```

### Configuration

```bash
ceobe setup                # Interactive first-time setup wizard
ceobe key set <p> <val>    # Save API key or provider config
ceobe key list             # Show all keys & active providers
ceobe key get <provider>   # Peek at a key (masked)
ceobe key remove <provider> # Delete a stored key
ceobe mode [autonomous|ask] # View or change execution mode
ceobe doctor               # Diagnose keys, providers & workspace
ceobe cost                 # Live token usage & API cost report
```

### Advanced

```bash
ceobe benchmark            # LLM benchmark — compare models on accuracy & cost
ceobe log [-n <lines>]     # View execution log
ceobe daemon --telegram    # Start remote Telegram bot
ceobe mcp                  # Launch MCP stdio server (for AI IDE integrations)
ceobe skill list           # Browse all 288 available skills
ceobe templates            # Manage project document templates
```

---

## Execution Modes

### Autonomous (default)
```bash
ceobe mode autonomous
ceobe auto "Build something"
```
Ceobe executes without interruption. Best for trusted, well-defined tasks.

### Human-in-the-Loop (ask)
```bash
ceobe mode ask
# or per-run:
ceobe auto "Refactor auth module" --ask
```

Actions requiring confirmation in `ask` mode:
- `write_file` · `edit_file` · `delete_file`
- `execute_command` · `rename_file` · `move_file`
- `start_background_service`

Confirmations are delivered via **readline in terminal** or **Telegram Inline Buttons** when using the daemon.

---

## Telegram Daemon

Control Ceobe remotely from your phone.

```bash
# 1. Set up credentials
ceobe key set telegram-token        <BOT_TOKEN>
ceobe key set telegram-allowed-users <YOUR_TELEGRAM_USER_ID>

# 2. Start the daemon
ceobe daemon --telegram
```

| Command | Action |
|---|---|
| `/start` | Wake bot & check status |
| `/projects` | List registered workspaces |
| `/addproject <name> <path>` | Register a workspace |
| `/cd <name>` | Switch active workspace |
| `/mode <ask\|autonomous>` | Toggle HITL / full-auto |
| `/auto` | Shortcut — set mode to autonomous |
| `/ask` | Shortcut — set mode to ask |
| `/status` | Pipeline status + queue |
| `/cost` | Live token usage & cost |
| `/logs` | Tail last 50 execution lines |
| `/read <file>` | Read a project file remotely |
| `/index` | Build semantic memory index (RAG) |
| `/doctor` | Run system diagnostics |
| `/reflect` | AI self-reflection on logs |
| `/reset` | Reset pipeline state |
| `/worktree` | Toggle worktree isolation mode |
| `/cancel` | Clear task queue |
| `/help` | Show command list |
| `<any message>` | Treated as a task instruction |

---

## Safety & Security

### Git Safety Net
- **Auto-snapshot** before every AI execution (`git commit`)
- **Auto-rollback** if self-healing fails after 3 retries (`git reset --hard`)
- **Worktree isolation** (`--worktree`) — merge to main only on success

### Budget Guard
- Default limit: **$5 USD** per session (`CEOBE_MAX_BUDGET`)
- Hard-stop with `BUDGET_EXCEEDED` error before API call
- Custom pricing override via `CEOBE_PRICING_OVERRIDE`

### Static Rule Checker
Runs automatically after execution on changed TypeScript files:

| Rule | Check |
|---|---|
| `RULE-01` | Controllers must not import from `/repository` or `/db` |
| `RULE-08` | No direct database access (`prisma.`, `db.`) in controllers |
| `RULE-13` | No hallucinated imports — all relative imports must resolve |
| `RULE-14` | Mandatory file header `// Tujuan:` in every file |
| `RULE-16` | No `SELECT *`, no N+1 queries in loops |

### Prompt Injection Hardening
All user input is wrapped in `<user_input>` tags with an explicit system-level instruction to ignore any embedded jailbreak attempts.

### Execution Limits
- Max **50 iterations** per executor session (anti-infinite-loop)
- Max **3 self-heal cycles** per session (JSON errors + command failures tracked separately)
- **Token bleed protection** — detects `max_tokens` exhaustion and recovers gracefully

---

## Memory & RAG System

Ceobe builds a **local semantic index** of your workspace:

```bash
ceobe index   # Build once (or after major changes)
```

- **Hybrid search**: Reciprocal Rank Fusion (RRF) combining vector search + full-text BM25
- **AST compression**: TypeScript files are compressed to signature-only before embedding (~80% token savings)
- **Incremental indexing**: Only re-indexes files that changed (mtime cache)
- **Dependency graph**: Understands cross-module import relationships
- **Tech-debt ledger**: Tracks `// ceobe:` and `// ponytail:` markers

Supported embedding providers: `gemini` · `openai` · `glm` · `ollama` · `together` · *custom*

---

## Plugin System

Drop a `.ts` file into `.ceobe/plugins/` — it becomes a new tool available to the Executor immediately.

```
.ceobe/
  plugins/
    my-custom-tool.ts   ← exported { name, description, input_schema, execute() }
```

No core modifications needed. The plugin loader auto-discovers and injects tools per session.

---

## Skills Library (288 skills)

Ceobe ships with 288 specialized skill files that are dynamically injected into prompts based on task context.

| Category | Count | Examples |
|---|---|---|
| **Security / CTF** | ~80 | `ctf-pwn-heap`, `ctf-crypto-rsa`, `ctf-pwn-kernel` |
| **Vulnerability** | ~50 | `vuln-sqli`, `vuln-jwt`, `vuln-ssrf`, `vuln-llm-attacks` |
| **Recon** | ~12 | `recon-subdomain`, `recon-dorking`, `recon-secrets` |
| **Payloads** | 13 | `payload-xss`, `payload-sqli`, `payload-xxe` |
| **Post-Exploit** | 7 | `post-linux-privesc`, `post-container-escape` |
| **Web Frameworks** | 11 | `framework-laravel`, `framework-nextjs`, `framework-django` |
| **Mobile** | 5 | `flutter`, `react-native`, `mobile-android`, `mobile-ios` |
| **Backend** | 8 | `golang`, `python-backend`, `elysia`, `hono` |
| **Database** | 4 | `prisma-orm`, `drizzle`, `database-architect` |
| **DevOps** | 7 | `tech-docker`, `tech-kubernetes`, `deployment-ops`, `tech-cicd` |
| **Testing** | 6 | `vitest`, `bdd-testing`, `visual-qa` |

```bash
ceobe skill list   # Browse all available skills
```

---

## MCP Server

Expose Ceobe's capabilities to any MCP-compatible AI coding tool (Cursor, Claude Desktop, etc.):

```bash
ceobe mcp
```

Available MCP tools:

| Tool | Description |
|---|---|
| `ceobe_extract_ast` | Compact AST summary of workspace |
| `ceobe_scan_debt` | Scan tech-debt markers |
| `ceobe_trim_codebase` | Full-repo bloat analysis |
| `check_tool_status` | Check if a security tool is installed |
| `run_pentest` | Launch autonomous pentest session |

Available MCP prompt: `ceobe-engineering-rules` — injects Ceobe's 18 engineering rules into AI context.

---

## Engineering Rules

Ceobe enforces 18 architecture rules across the planning and verification phases:

1. **Layered Architecture** — strict layer boundaries, Adaptive Legacy Fallback
2. **Separation of Concerns** — one responsibility per module
3. **Thin Controllers** — no business logic in HTTP handlers
4. **Explicit Error Handling** — no silent catches
5. **Consistent Naming** — enforced conventions per language
6. **Modular Design** — small, focused, reusable modules
7. **Framework Isolation** — core logic must not depend on framework internals
8. **Repository Pattern** — all DB access via repository layer
9. **Simplicity Over Cleverness** — YAGNI, boring tech wins
10. **Decision Documentation** — ADRs required for non-obvious choices
11. **Task Decomposition** — all work planned before execution
12. **Safe Modification** — "Add, Don't Break" strategy
13. **AI Strict Constraints** — no hallucinated imports, verify before editing
14. **Mandatory File Header** — `// Tujuan:` required in every file
15. **Token Efficiency** — compact prompts, read before edit
16. **DB Performance** — no `SELECT *`, no N+1 in loops
17. **Pre-Edit Trace** — AI must read file before modifying it
18. **Zero-Downtime Migrations** — Expand & Contract pattern

Export these rules to your IDE:
```bash
ceobe export-rules
# Writes to: .cursor/rules/ceobe.mdc · .windsurf/rules/ceobe.md · .clinerules · .agents/rules/AGENTS.md
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CEOBE_PLANNER_PROVIDER` | — | Provider for Planner brain |
| `CEOBE_EXECUTOR_PROVIDER` | — | Provider for Executor brain |
| `CEOBE_QA_PROVIDER` | *(falls back to Planner)* | Provider for QA Auditor |
| `CEOBE_EMBEDDING_PROVIDER` | *(falls back to Planner)* | Provider for RAG embeddings |
| `CEOBE_*_MODEL` | *(provider default)* | Model override per role |
| `CEOBE_MAX_BUDGET` | `5` | Budget limit in USD (0 = unlimited) |
| `CEOBE_MAX_TOKENS` | `16384` | Max output tokens per call |
| `CEOBE_SANDBOX` | `none` | `docker` to isolate execution |
| `CEOBE_SANDBOX_IMAGE` | — | Custom Docker image for sandbox |
| `CLOUDFLARE_ACCOUNT_ID` | — | Cloudflare AI Gateway account |
| `CLOUDFLARE_GATEWAY_ID` | — | Cloudflare AI Gateway ID |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token for daemon |
| `TELEGRAM_ALLOWED_USERS` | — | Comma-separated Telegram user IDs |

---

## Runtime Files (`.ceobe/`)

| File | Purpose |
|---|---|
| `brd.md` | Business Requirements Document |
| `design.md` | UI/UX Design Specification |
| `architecture.md` | System Architecture Document |
| `devops.md` | DevOps & Deployment Config |
| `task.md` | Implementation Task Plan |
| `config.json` | Mode config (autonomous/ask) |
| `ceobe-state.json` | Pipeline state & phase tracking |
| `execution.log` | Full execution log |
| `embeddings.json` | Vector index for RAG |
| `full-text-index.json` | BM25 full-text index |
| `dependency-graph.json` | Module dependency map |
| `plugins/` | Custom plugin directory |
| `skills/` | Custom project-local skills |

---

## Contributing

Ceobe is designed for extension. The simplest contribution is a new skill:

1. Fork the repository
2. Create `skills/<your-skill-name>/` with a `.md` file
3. Submit a Pull Request

For core contributions, follow the 18 engineering rules enforced by Ceobe itself.

---

## License

[MIT](LICENSE) · Built by [Yoragam1](https://github.com/Yoraexe)
