---
name: frontend-design
description: Guidelines for creating premium, stunning, and highly responsive user interfaces.
---
# FRONTEND DESIGN SKILL

## 1. The Wow Factor
The user must be WOW'ed at first glance. Interfaces must feel premium, alive, and highly polished. Do not output raw 2010s HTML/CSS. If it looks like a generic Bootstrap template, you have failed.

## 2. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use pure black (`#000000`) or pure white (`#FFFFFF`) for backgrounds. Use off-white (`#F8FAFC`) or deep gray/blue (`#0F172A`).
- ❌ Never use default system fonts if you can avoid it. Always import modern fonts (Inter, Roboto, Outfit, Poppins).
- ❌ Never use static buttons. All interactive elements MUST have hover and active states with transitions.
- ❌ Never use raw CSS `float`. Always use Flexbox or Grid.

## 3. Practical Patterns (Vanilla CSS)

### 3.1 Color Palette & Variables
Always define a robust color palette in the `:root`.

```css
:root {
  /* Colors - Slate & Indigo theme */
  --bg-primary: #f8fafc;
  --bg-surface: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --brand-primary: #6366f1;
  --brand-hover: #4f46e5;
  --border-color: #e2e8f0;
  
  /* Shadows & Radius */
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease-in-out;
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0f172a;
    --bg-surface: #1e293b;
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --border-color: #334155;
  }
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
  line-height: 1.5;
  margin: 0;
}
```

### 3.2 Micro-Animations & Buttons
Every interactive element should respond to the user.

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  background-color: var(--brand-primary);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.button:hover {
  background-color: var(--brand-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.button:active {
  transform: translateY(0);
}
```

### 3.3 Glassmorphism (Premium Feel)
For modals, headers, or floating cards, use glassmorphism sparingly.

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

@media (prefers-color-scheme: dark) {
  .glass-panel {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}
```

### 3.4 Responsive Grid
Always build mobile-first.

```css
.grid-container {
  display: grid;
  grid-template-columns: 1fr; /* Mobile default */
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .grid-container {
    grid-template-columns: repeat(2, 1fr); /* Tablet */
  }
}

@media (min-width: 1024px) {
  .grid-container {
    grid-template-columns: repeat(3, 1fr); /* Desktop */
  }
}
```