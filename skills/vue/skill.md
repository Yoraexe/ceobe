# Skill: Vue 3 Architecture & Patterns

## 1. Metadata
- **Name:** `vue`
- **Origin:** `Astesia Core`
- **Description:** Standards for building Vue 3 applications. Emphasizes the Composition API (`<script setup>`), Pinia for state management, and strict TypeScript integration.

## 2. When to Use
Invoke this skill when building a frontend application using Vue.js.

## 3. Constraints (Anti-Patterns — NEVER DO)
- ❌ Never use the Vue 2 Options API (`data()`, `methods`, `created()`). Always use Vue 3 `<script setup>`.
- ❌ Never mutate props directly — emit events to the parent.
- ❌ Never use Vuex — use Pinia for global state.
- ❌ Never use `any` in TypeScript setups. Define strict interfaces for props and emits.

## 4. Practical Patterns

### Single File Component (Composition API)
```vue
<!-- src/components/UserProfile.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { User } from '@/types';

// 1. Props with TypeScript
const props = defineProps<{
  user: User;
  isLoading?: boolean;
}>();

// 2. Emits
const emit = defineEmits<{
  (e: 'update', newName: string): void;
  (e: 'delete', id: number): void;
}>();

// 3. Reactive State
const isEditing = ref(false);
const draftName = ref(props.user.name);

// 4. Computed properties
const displayName = computed(() => {
  return props.user.name.toUpperCase();
});

// 5. Methods
const save = () => {
  emit('update', draftName.value);
  isEditing.value = false;
};

// 6. Lifecycle hooks
onMounted(() => {
  console.log('Component mounted for user:', props.user.id);
});
</script>

<template>
  <div class="user-profile">
    <div v-if="isLoading">Loading...</div>
    <div v-else>
      <h2>{{ displayName }}</h2>
      
      <div v-if="isEditing">
        <input v-model="draftName" @keyup.enter="save" />
        <button @click="save">Save</button>
      </div>
      <div v-else>
        <button @click="isEditing = true">Edit</button>
        <button class="danger" @click="emit('delete', user.id)">Delete</button>
      </div>
    </div>
  </div>
</template>
```

### Pinia Store (Setup Syntax)
```typescript
// src/stores/auth.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types';
import { api } from '@/utils/api';

export const useAuthStore = defineStore('auth', () => {
  // State (refs)
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('token'));

  // Getters (computed)
  const isAuthenticated = computed(() => !!token.value);
  const userName = computed(() => user.value?.name || 'Guest');

  // Actions (functions)
  async function login(credentials: Record<string, string>) {
    const res = await api.post('/auth/login', credentials);
    token.value = res.token;
    user.value = res.user;
    localStorage.setItem('token', res.token);
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  return { user, token, isAuthenticated, userName, login, logout };
});
```

### Composable Pattern (Reusability)
```typescript
// src/composables/useFetch.ts
import { ref, isRef, unref, watchEffect } from 'vue';

export function useFetch<T>(url: string | import('vue').Ref<string>) {
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const isFetching = ref(false);

  async function doFetch() {
    isFetching.value = true;
    error.value = null;
    try {
      const res = await fetch(unref(url));
      if (!res.ok) throw new Error('Fetch failed');
      data.value = await res.json();
    } catch (e: any) {
      error.value = e;
    } finally {
      isFetching.value = false;
    }
  }

  // Auto-refetch if URL is a ref and it changes
  if (isRef(url)) {
    watchEffect(doFetch);
  } else {
    doFetch();
  }

  return { data, error, isFetching, refetch: doFetch };
}
```

## 5. Standard Libraries
- **Routing:** `vue-router` v4
- **State:** `pinia`
- **Data Fetching:** `vue-query` (TanStack Query) or custom composables
- **Testing:** `vitest` + `@vue/test-utils`
