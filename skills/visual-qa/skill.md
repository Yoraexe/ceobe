# Skill: Visual QA (Browser Automation)

## 1. Description
Visual regression and UI fidelity testing using Computer Vision. Solves the LLM "blindspot" where code syntax is correct but the rendered UI is broken.

## 2. Trigger
Executed during Phase 4 (Quality Layer) if the project contains frontend components.

## 3. Rules & Execution
1. **Server Boot:** Start the local development server (e.g., `npm run dev`).
2. **Capture:** Use Playwright/Puppeteer to navigate to the rendered components and capture a full-page screenshot.
3. **Vision Analysis:** Send the screenshot back to the Gemini Vision model.
4. **Fidelity Check:** The Vision model compares the screenshot against the `design-system.md` specifications (colors, margins, overlaps, accessibility contrast).
5. **Remediation:** If visual defects are found (e.g., "Button is overlapping text"), return a specific CSS/Tailwind correction instruction to the Engineering Layer.
