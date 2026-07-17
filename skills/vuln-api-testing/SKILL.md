---
name: vuln-api-testing
description: "REST API security testing — endpoint discovery, authentication testing, rate limiting bypass, versioning attacks, excessive data exposure, API security top 10. Triggers: 'api testing', 'rest api', 'api security', 'api pentest', 'api endpoints', 'api vulnerability', 'api rate limit', 'api auth bypass', 'rest security', 'excessive data exposure'."
---

# REST API Security Testing

Systematic security assessment of REST APIs covering OWASP API Security Top 10.

---

## Phase 1: API Discovery

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"  # if available

# Discover API endpoints:
# 1. Check spec files:
curl -s "$TARGET/swagger.json" | jq '.paths | keys' | tee output/api_paths.txt
curl -s "$TARGET/openapi.json" | jq '.paths | keys' >> output/api_paths.txt
curl -s "$TARGET/api-docs" | jq '.paths | keys' >> output/api_paths.txt

# 2. Brute force paths:
ffuf -u "$TARGET/api/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt \
  -H "Authorization: Bearer $TOKEN" \
  -mc 200,201,204,400,401,403 \
  -o output/api_ffuf.json 2>&1

# 3. Extract from JavaScript:
curl -s "$TARGET/" | grep -oE '"https?://[^"]+/api/[^"]*"' | sort -u
curl -s "$TARGET/static/app.js" | grep -oE '"/api/[^"]*"' | sort -u | tee -a output/api_paths.txt
```

---

## Phase 2: Authentication Testing

```bash
TARGET="https://TARGET"

# Test endpoint without auth:
while IFS= read -r EP; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$EP")
  echo "$EP → $STATUS (no auth)"
done < output/api_paths.txt | grep -v "^/api.*404" | tee output/api_no_auth.txt

# Test token reuse after logout:
curl -s -X POST "$TARGET/api/v1/auth/logout" -H "Authorization: Bearer $TOKEN"
RESP=$(curl -s "$TARGET/api/v1/profile" -H "Authorization: Bearer $TOKEN")
echo "Post-logout access: $RESP"

# Test expired token:
EXPIRED_TOKEN="eyJhbGc..."  # expired token
curl -s "$TARGET/api/v1/profile" -H "Authorization: Bearer $EXPIRED_TOKEN"
```

---

## Phase 3: Excessive Data Exposure

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Check if API returns more data than UI displays:
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/users/me" | jq .
# Does response include: password_hash, internal_id, created_at, flags, PII of other users?

# Check list endpoints for over-exposure:
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/users" | jq '.[] | keys'
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/transactions" | jq '.[0]'

# Filter bypass — request extra fields:
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/users/me?fields=password,secret_key,admin_notes"
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/users/me?include=all"
```

---

## Phase 4: Rate Limiting & Security Headers

```bash
TARGET="https://TARGET"

# Rate limiting test — rapid sequential requests:
for i in $(seq 1 100); do
  curl -s -X POST "$TARGET/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}' -o /dev/null &
done
wait
# Check if account locked or rate limited

# Check security headers:
curl -s -I "$TARGET/api/v1/profile" | grep -iE "strict-transport|content-security|x-frame|x-content-type|access-control"

# Check HTTP methods:
curl -s -X OPTIONS "$TARGET/api/v1/users" -I | grep -i "allow:"
```

---

## Phase 5: API Versioning Attacks

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Test older API versions for missing security:
for VER in v0 v1 v2 v3 v4 beta alpha; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" "$TARGET/api/$VER/users")
  echo "API/$VER: $STATUS"
done | tee output/api_versions.txt

# Old version without auth:
for VER in v0 v1 beta; do
  curl -s "$TARGET/api/$VER/users" | head -20
done
```

---

## Output

Save to `output/`:
- `api_paths.txt` — discovered API endpoints
- `api_no_auth.txt` — unauthenticated endpoint access
- `api_ffuf.json` — brute force results

## Next Phase

→ `vuln-idor` for object-level authorization testing
→ `vuln-bfla` for function-level authorization testing
→ `pentest-report` to document findings
