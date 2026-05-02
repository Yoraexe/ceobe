# Skill: SvelteKit Architecture & Patterns

## 1. Metadata
- **Name:** `sveltekit`
- **Origin:** `Astesia Core`
- **Description:** Standards for building SvelteKit applications. Emphasizes server-side rendering, form actions, and Svelte 5 syntax.

## 2. When to Use
Invoke this skill when building a frontend or fullstack web application using SvelteKit.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use `export let data` — Svelte 5 uses `$props()`.
- ❌ Never put sensitive API keys in `+page.ts` — use `+page.server.ts`.
- ❌ Never manually handle `fetch` for form submissions unless absolutely necessary — use SvelteKit Form Actions with `use:enhance`.
- ❌ Never put global state in raw `.ts` files — use Svelte `context` or stores to avoid state bleeding across SSR requests.

## 4. Practical Patterns

### Component Syntax (Svelte 5 Runes)
```svelte
<!-- src/components/Counter.svelte -->
<script lang="ts">
  // Always use $props(), $state(), and $derived() instead of old syntax
  let { initialCount = 0 } = $props<{ initialCount?: number }>();
  
  let count = $state(initialCount);
  let double = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<button onclick={increment}>
  Count: {count} (Double: {double})
</button>
```

### Server Load & Form Actions
```typescript
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z } from 'zod';

// 1. Data loading (Runs on server only)
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) throw redirect(302, '/dashboard');
  return { seoTitle: 'Login' };
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

// 2. Form Actions
export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const result = loginSchema.safeParse(Object.fromEntries(formData));
    
    if (!result.success) {
      return fail(400, { 
        errors: result.error.flatten().fieldErrors,
        email: formData.get('email')?.toString()
      });
    }

    try {
      const { email, password } = result.data;
      const session = await authService.login(email, password);
      
      cookies.set('session', session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
    } catch (err) {
      return fail(401, { message: 'Invalid credentials' });
    }

    throw redirect(302, '/dashboard');
  }
};
```

### Form UI with Progressive Enhancement
```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form } = $props<{ data: PageData, form: ActionData }>();
</script>

<svelte:head>
  <title>{data.seoTitle}</title>
</svelte:head>

<!-- use:enhance handles JS-based submission automatically -->
<form method="POST" use:enhance>
  {#if form?.message}
    <p class="error">{form.message}</p>
  {/if}

  <label>
    Email:
    <input type="email" name="email" value={form?.email ?? ''} required />
  </label>
  {#if form?.errors?.email}
    <span class="error">{form.errors.email[0]}</span>
  {/if}

  <label>
    Password:
    <input type="password" name="password" required />
  </label>

  <button type="submit">Login</button>
</form>
```

### API Routes
```typescript
// src/routes/api/users/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  
  const limit = Number(url.searchParams.get('limit')) || 10;
  const users = await db.getUsers(limit);
  
  return json(users);
};
```

## 5. Directory Structure
```
src/
├── lib/               # Internal library (components, utils, stores)
│   ├── components/    # Reusable UI components
│   └── server/        # Server-only code (secrets, DB)
├── routes/            # File-based routing
│   ├── +layout.svelte # Shared layout
│   ├── +page.svelte   # Homepage
│   └── api/           # API endpoints
└── app.d.ts           # App interfaces (Locals, PageData)
```
