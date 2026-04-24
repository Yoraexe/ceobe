# Ceobe Mastery CLI 🚀

An autonomous AI Engineering orchestrator CLI powered by Gemini 3.1 Pro (Planner) and Claude 4.6 Sonnet (Executor).

## Features
- **5-Phase Architecture:** Plan -> Design -> Engineering -> Quality -> DevOps.
- **Microservices & Monorepo Ready.**
- **Human-in-the-Loop:** Intervene and modify Agent plans before a single line of code is written.
- **Dynamic Skill Routing:** Equipped with 15+ specialized engineering rules (Bun, Next.js, Cloudflare, Security, etc).

## Installation

```bash
npm install -g ceobe-mastery-cli
```

### Environment Variables
You must configure the following in your system or a local `.env` file to use the CLI:
```env
CLOUDFLARE_ACCOUNT_ID=your_id
CLOUDFLARE_GATEWAY_ID=your_gateway
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
```

## How to Contribute (Open Source)
Ceobe is designed to be infinitely expandable. You can make it more powerful by adding new Skills or Engineering Rules!

1. Fork this repository.
2. Clone it locally: `git clone https://github.com/Yoraexe/ceobe.git`
3. Add a new Markdown skill in the `skills/` folder (e.g. `skills/python-expert/`).
4. Submit a Pull Request! The community grows stronger when the AI learns new native skills.

## License
[MIT](LICENSE)
