# STATE & ROUTING
1. Keep global state minimal. Use React Query / SWR for server state, and local `useState` for UI state.
2. Implement route-level code splitting to keep the initial JS bundle ultra-small.