---
name: vuln-sensitive-exposure
description: "Sensitive data and PII exposure testing — credentials in responses, API key leakage, PII in logs/responses, unencrypted sensitive data, EXIF data, S3 bucket exposure, cloud storage misconfig. Triggers: 'sensitive data', 'pii exposure', 'credential leak', 'api key exposure', 'data exposure', 'unencrypted data', 's3 exposure', 'secret in response', 'data leakage'."
---

# Sensitive Data & PII Exposure Testing

Identify inadvertently exposed credentials, API keys, PII, and sensitive business data.

---

## Phase 1: API Response Analysis

```bash
TARGET="https://TARGET"
TOKEN="USER_TOKEN"

# Check API responses for sensitive fields:
curl -s -H "Authorization: Bearer $TOKEN" "$TARGET/api/v1/profile" | \
  python3 -c "import sys, json; d=json.load(sys.stdin); [print(k,':',v) for k,v in d.items() if any(x in k.lower() for x in ['pass','key','secret','token','hash','ssn','credit','card','dob'])]"

# Check all endpoints for PII in responses:
while IFS= read -r EP; do
  RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$TARGET$EP" 2>/dev/null)
  FOUND=$(echo "$RESP" | grep -iE '"(password|secret|key|token|ssn|credit_card|dob|bank_account|cvv|pin)"')
  [ -n "$FOUND" ] && echo "PII in $EP: $FOUND"
done < output/api_paths.txt | tee output/sensitive_data.txt
```

---

## Phase 2: JavaScript & Client-Side Exposure

```bash
TARGET="https://TARGET"

# Scan JS files for secrets:
# Install gitleaks or trufflehog:
pip3 install truffleHog 2>/dev/null

# Extract all JS URLs and scan:
curl -s "$TARGET/" | grep -oE '"https?://[^"]+\.js"' | sort -u > /tmp/js_urls.txt
while IFS= read -r URL; do
  curl -s "$URL" | grep -iE '(api_key|apikey|api-key|secret|password|access_token|client_secret|aws_secret|stripe_key|twilio_auth)[\s]*[=:]\s*["\x27][a-zA-Z0-9_\-]{20,}'
done < /tmp/js_urls.txt | tee output/js_secrets.txt

# Use trufflehog on JS content:
curl -s "$TARGET/static/app.js" > /tmp/app.js
trufflehog filesystem /tmp/app.js 2>&1 | tee output/trufflehog_js.txt
```

---

## Phase 3: Cloud Storage Exposure

```bash
TARGET="target.com"

# S3 bucket discovery and access:
aws s3 ls "s3://$TARGET" --no-sign-request 2>&1
aws s3 ls "s3://www.$TARGET" --no-sign-request 2>&1
aws s3 ls "s3://backup.$TARGET" --no-sign-request 2>&1
aws s3 ls "s3://dev.$TARGET" --no-sign-request 2>&1
aws s3 ls "s3://staging.$TARGET" --no-sign-request 2>&1

# Also check via HTTP:
curl -s "https://$TARGET.s3.amazonaws.com/" | grep -i "ListBucketResult"
curl -s "https://s3.amazonaws.com/$TARGET/" | grep -i "ListBucketResult"

# If accessible, list contents:
aws s3 ls "s3://$TARGET/" --no-sign-request 2>/dev/null | tee output/s3_contents.txt

# GCP Storage:
curl -s "https://storage.googleapis.com/$TARGET/" | grep -i "ListBucketResult"

# Azure Blob Storage:
curl -s "https://${TARGET//./-}.blob.core.windows.net/?comp=list" | grep -i "Blob"
```

---

## Phase 4: Error Message Credential Exposure

```bash
TARGET="https://TARGET"

# Trigger database connection errors to reveal credentials:
curl -s "$TARGET/api/v1/search?q='" | grep -iE "mysql|postgres|mongodb|username|password|host"
curl -s "$TARGET/api/v1/search?q=1 AND 1=1" | grep -iE "jdbc:|connect"

# Stack traces revealing file paths and credentials:
curl -s "$TARGET/api/v1/" -H "Content-Type: application/json" -d '{}' | \
  grep -iE "/home|/var|/usr|password|secret|api_key|connection_string"
```

---

## Output

Save to `output/`:
- `sensitive_data.txt` — PII/credentials in API responses
- `js_secrets.txt` — secrets found in JavaScript
- `s3_contents.txt` — accessible S3 bucket contents

## Next Phase

→ Use discovered credentials for access escalation
→ `pentest-report` to document data exposure with compliance impact
