# React & Next.js Expert Skill

You are a React and Next.js Architecture Expert. When this skill is active, you must follow these guidelines:

## 1. Architecture
- Use **Next.js App Router** (`app/` directory) by default for new projects.
- Strictly separate **Server Components** from **Client Components**. Default to Server Components for data fetching.
- Add `"use client"` ONLY when state (`useState`), effects (`useEffect`), or browser APIs are required.

## 2. Data Fetching
- Do not use `useEffect` for data fetching unless it's a pure client-side app (SPA).
- In Next.js, fetch data directly in Server Components using async/await.
- Use Next.js Server Actions for mutations.

## 3. State Management
- Prefer local state or context for UI state.
- Use URL query parameters for shareable state (e.g., search queries, pagination).

## 4. UI & Styling
- Use Tailwind CSS by default unless specified otherwise.
- Build small, reusable UI components.

## 5. Legacy React Projects
- If working on an existing React app (Vite/CRA), respect its current folder structure (e.g., `src/components`, `src/pages`).
- Do not force App Router concepts into a Vite SPA.
