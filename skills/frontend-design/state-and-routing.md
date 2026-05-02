# State & Routing Patterns (Frontend Design)

## Client-Side Routing (Vanilla JS)
For simple SPAs without a framework, use the History API:

```javascript
const routes = {
  '/': () => renderHome(),
  '/about': () => renderAbout(),
  '/contact': () => renderContact(),
};

function navigate(path) {
  history.pushState(null, '', path);
  const handler = routes[path] || routes['/'];
  handler();
}

// Handle back/forward buttons
window.addEventListener('popstate', () => {
  const handler = routes[location.pathname] || routes['/'];
  handler();
});

// Intercept link clicks
document.addEventListener('click', (e) => {
  if (e.target.matches('a[data-link]')) {
    e.preventDefault();
    navigate(e.target.getAttribute('href'));
  }
});
```

## Global State (Vanilla JS — Pub/Sub Pattern)
```javascript
function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState: () => ({ ...state }),
    setState: (partial) => {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}

// Usage
const store = createStore({ user: null, theme: 'light' });
store.subscribe((state) => console.log('State changed:', state));
store.setState({ user: { name: 'Alice' } });
```

## CSS Transitions for Page Swaps
```css
.page-enter {
  opacity: 0;
  transform: translateX(20px);
}

.page-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all 300ms ease-out;
}
```