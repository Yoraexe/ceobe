# Skill: Vue/Nuxt Frontend Architecture

## 1. Metadata
- **Name:** `vue-frontend`
- **Origin:** `Astesia Core`
- **Description:** Architecture patterns for Vue 3 and Nuxt 3 applications. Covers Composition API, Pinia for state management, Vue Router, and SSR patterns.

## 2. When to Use
Invoke this skill when:
- The Engineering Layer is building a frontend using Vue 3 or Nuxt 3.
- Implementing reactive user interfaces that require clear separation of state and template logic.
- Building SEO-friendly web apps using Nuxt's SSR capabilities.

## 3. Practical Guidance

### Project Structure (Nuxt 3 Standard)
```
/
├── app.vue               # Main application entry
├── nuxt.config.ts        # Framework configuration
├── pages/                # File-based routing (Vue components)
│   ├── index.vue
│   └── users/
│       └── [id].vue      # Dynamic route
├── components/           # Auto-imported UI components
│   ├── ui/               # Base components (Button, Input)
│   └── feature/          # Domain-specific components
├── layouts/              # Reusable page wrappers
│   └── default.vue
├── composables/          # Auto-imported Composition API hooks
│   ├── useAuth.ts
│   └── useApi.ts
├── store/                # Pinia stores (global state)
│   └── auth.ts
├── server/               # Nuxt Nitro API routes (if needed)
│   └── api/
├── middleware/           # Route middleware (e.g., auth guards)
└── assets/               # Global CSS and images
```

### Composition API (Script Setup)
Always use `<script setup>` with Vue 3 for concise, performant component logic.

```vue
<!-- components/UserCard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { User } from '~/types';

// Define props with TypeScript
const props = defineProps<{
  user: User;
  isActive?: boolean;
}>();

// Define emits for parent communication
const emit = defineEmits<{
  (e: 'delete', id: number): void;
}>();

// Reactive state
const isExpanded = ref(false);

// Computed properties
const displayName = computed(() => 
  props.user.name.toUpperCase()
);

function handleDelete() {
  emit('delete', props.user.id);
}
</script>

<template>
  <div class="p-4 border rounded" :class="{ 'bg-blue-50': isActive }">
    <h3>{{ displayName }}</h3>
    <button @click="isExpanded = !isExpanded">Toggle Details</button>
    
    <div v-if="isExpanded">
      <p>{{ user.email }}</p>
      <button @click="handleDelete" class="text-red-500">Delete</button>
    </div>
  </div>
</template>
```

### Data Fetching in Nuxt (SSR/CSR)
Use Nuxt's built-in composables `useFetch` or `useAsyncData` to handle hydration correctly without double-fetching.

```vue
<!-- pages/users/index.vue -->
<script setup lang="ts">
// This runs on the server during SSR, and on the client during navigation.
// It automatically deduplicates the request during hydration.
const { data: users, pending, error } = await useFetch('/api/users', {
  // Optional: transform response
  transform: (res) => res.data
});
</script>

<template>
  <div>
    <h1>Users</h1>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error loading users.</div>
    <ul v-else>
      <li v-for="user in users" :key="user.id">{{ user.name }}</li>
    </ul>
  </div>
</template>
```

### Global State Management (Pinia)
Avoid deep prop-drilling or large reactive objects. Use Pinia stores for global state.

```typescript
// store/auth.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!token.value);

  // Actions
  async function login(credentials: Credentials) {
    const res = await $fetch('/api/login', { method: 'POST', body: credentials });
    token.value = res.token;
    user.value = res.user;
  }

  function logout() {
    token.value = null;
    user.value = null;
  }

  return { user, token, isAuthenticated, login, logout };
});
```

## 4. Tested Examples
(See above for component, fetching, and state management patterns)
