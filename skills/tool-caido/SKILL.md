---
name: tool-caido
description: "Caido web security proxy — intercepting proxy, replay, automate, workflow rules, filter, match/replace, HTTPQL querying, Caido Automate for fuzzing. Triggers: 'caido', 'caido proxy', 'caido intercept', 'caido replay', 'caido automate', 'caido workflow', 'caido fuzz', 'web proxy testing'."
---

# Caido Web Security Proxy

Modern intercepting proxy for web application testing.

---

## Phase 1: Setup & Interception

```bash
# Start Caido (default port 8080):
caido 2>/dev/null &
# Or via desktop app, then configure browser proxy → 127.0.0.1:8080

# Install CA cert:
curl -sk "http://127.0.0.1:8080/ca" -o caido-ca.crt
# Import in browser: Settings → Certificates → Import

# Basic curl through Caido:
curl -sk --proxy "http://127.0.0.1:8080" "https://TARGET/api/endpoint" \
  -H "Authorization: Bearer TOKEN" | jq .

# All traffic via environment proxy:
export https_proxy=http://127.0.0.1:8080
export REQUESTS_CA_BUNDLE=/path/to/caido-ca.crt
```

---

## Phase 2: HTTPQL Filtering

```
# Filter requests by path:
path contains "/api/"

# Filter by status:
response.status is 401

# Find with specific param:
request.raw contains "password"

# Find POST to auth endpoints:
method is "POST" and path contains "/login"

# Find JSON responses with sensitive keys:
response.raw contains "\"token\""

# Requests with specific header:
request.header "Authorization" exists
```

---

## Phase 3: Replay & Modification

```bash
# Replay requests with modified parameters:
# 1. Right-click request in Caido → "Send to Replay"
# 2. Modify: change parameter value, method, headers
# 3. Compare responses side-by-side

# Match & Replace rules:
# Settings → Match & Replace:
# Pattern: Authorization: Bearer .*
# Replace: Authorization: Bearer NEW_TOKEN

# Request to repeat with different auth:
# Settings → Scope → Add target domain
# Then: forward/intercept all in-scope requests
```

---

## Phase 4: Caido Automate (Fuzzing)

```
# Automate = Intruder equivalent:
# 1. Send request to Automate
# 2. Mark positions: <<FUZZ>>
# 3. Set payload: wordlist or range

# Credential stuffing example:
POST /login HTTP/1.1
{"username": "<<USER>>", "password": "<<PASS>>"}

# Payload config:
# Position 1 (USER): Wordlist → usernames.txt
# Position 2 (PASS): Wordlist → passwords.txt  
# Attack: Pitchfork (one-to-one)

# IDOR testing:
GET /api/user/<<ID>> HTTP/1.1

# Payload: Number range 1-1000
# Filter: response.status is 200

# Filter results by response diff:
# Diff base response size → find anomalies
```

---

## Output

Save to `output/`:
- Export interesting requests via Caido → CSV or HTTPQL export
- `caido_findings.txt` — notable request/response pairs

## Next Phase

→ `vuln-idor` for IDOR exploitation using Automate findings
→ `vuln-auth-workflow` for auth bypass chains
