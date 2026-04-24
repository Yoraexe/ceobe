# Skill: SvelteKit Frontend Architecture

## 1. Metadata
- **Name:** `sveltekit-frontend`
- **Origin:** `Astesia Core`
- **Description:** Architecture patterns for SvelteKit applications. Enforces strict separation between Server (`+page.server.ts`), Client (`+page.svelte`), and data fetching logic.

## 2. When to Use
Invoke this skill when:
- Building a frontend application using SvelteKit (Astesia's default frontend).
- The Design Layer has output `design-system.md` with tokens that need implementation.
- Building forms that require robust validation (Superforms).

## 3. Practical Guidance

### Project Structure
```
src/
├── app.html              # HTML shell
├── routes/               # File-system routing
│   ├── +layout.svelte    # Root layout (providers, global styles)
│   ├── +page.svelte      # Home page component
│   ├── +page.server.ts   # Home page server-side data fetching
│   └── (auth)/           # Route group
│       ├── login/
│       │   ├── +page.svelte
│       │   └── +page.server.ts
├── lib/                  # SvelteKit $lib alias
│   ├── components/       # Shared UI components
│   │   ├── ui/           # Primitive UI (Button, Input)
│   │   └── layout/       # Layout components
│   ├── server/           # Server-only utilities (db, secrets)
│   │   ├── db.ts         
│   │   └── auth.ts       
│   ├── stores/           # Svelte stores / Runes state
│   └── utils/            # Generic helpers
```

### Server Load vs Client Load vs Component

```typescript
// ✅ Server Load (+page.server.ts) — Runs ONLY on server, safe for secrets/DB
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const users = await db.query.users.findMany();
  return { users }; // Data passed to +page.svelte via data prop
};

// ✅ Component (+page.svelte) — Receives data from server load
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  
  // Svelte 5 Runes state (if interactivity needed)
  let search = $state('');
  let filtered = $derived(data.users.filter(u => u.name.includes(search)));
</script>

<input bind:value={search} />
{#each filtered as user}
  <div>{user.name}</div>
{/each}
```

### Forms and Actions (Superforms)
Do not use raw `fetch()` in components for form submission. Use standard SvelteKit actions, ideally augmented with Superforms and Zod.

```typescript
// +page.server.ts
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { userSchema } from '$lib/schemas/user';
import { fail } from '@sveltejs/kit';

export const load = async () => {
  const form = await superValidate(zod(userSchema));
  return { form };
};

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(userSchema));
    if (!form.valid) return fail(400, { form });
    
    // Save to DB...
    return { form };
  }
};
```

```html
<!-- +page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms/client';
  export let data;
  
  const { form, errors, enhance } = superForm(data.form);
</script>

<form method="POST" use:enhance>
  <input name="name" bind:value={$form.name} />
  {#if $errors.name}<span>{$errors.name}</span>{/if}
  <button>Submit</button>
</form>
```

### Design Token Integration
Map Design Layer tokens to CSS variables or Tailwind config just like any other modern framework:

```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--color-primary))',
        // ... mapped from design-system.md
      }
    }
  }
}
```

## 4. Tested Examples
(See above for standard Load, Actions, and Form integrations)
