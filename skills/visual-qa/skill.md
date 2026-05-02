# Skill: Visual QA (Browser Automation)

## 1. Description
Visual regression and UI fidelity testing using Computer Vision. Solves the LLM "blindspot" where code syntax is correct but the rendered UI is broken.

## 2. Trigger
Executed during Phase 4 (Quality Layer) if the project contains frontend components.

## 3. Architecture Reference
This skill is implemented by two source modules:
- **Tool Definition:** `src/ai/tools/systemTools.ts` — the `visual_audit` tool (lines 265-278) accepts a URL or local file path.
- **Browser Engine:** `src/utils/browserAutomation.ts` — uses Puppeteer in headless mode to launch Chromium, navigate to the page, and capture a full-page PNG screenshot at 1280×800 viewport.
- **Multimodal Return:** The screenshot is returned as a `base64` image block alongside a text description, allowing Claude to visually inspect the rendered UI.

## 4. Rules & Execution
1. **Server Boot:** Start the local development server using `start_background_service` (e.g., `npm run dev`).
2. **Wait for Ready:** Allow 3-5 seconds for the dev server to compile and start serving.
3. **Capture:** Call the `visual_audit` tool with the server URL (e.g., `http://localhost:5173`).
4. **Vision Analysis:** Claude receives the screenshot as a base64 image and compares it against the design specifications.
5. **Fidelity Checklist:**
   - ✅ Layout matches the wireframe (no overlapping elements).
   - ✅ Color palette matches `design.md` specifications.
   - ✅ Typography hierarchy is correct (h1 > h2 > h3 > body).
   - ✅ Responsive breakpoints don't cause horizontal scroll.
   - ✅ Interactive elements (buttons, inputs) have visible focus states.
6. **Remediation:** If visual defects are found (e.g., "Button is overlapping text"), return a specific CSS correction instruction to the Engineering Layer via the `edit_file` tool.

## 5. Anti-Patterns
- ❌ Never skip visual QA for projects that include a frontend — CSS bugs are invisible to `tsc --noEmit`.
- ❌ Never capture a screenshot before the page has fully loaded — always use `waitUntil: 'networkidle0'`.
- ❌ Never compare screenshots pixel-by-pixel — use semantic analysis (does the layout look correct?) instead.
