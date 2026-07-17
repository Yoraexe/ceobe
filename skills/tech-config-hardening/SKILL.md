---
name: tech-config-hardening
description: "Web application and server configuration hardening review. Security header audit (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), TLS/SSL configuration check, debug endpoint enumeration (actuator, metrics, env, debug, swagger), verbose error message detection, backup and config file exposure check (.env, .env.bak, config.php.bak, backup.sql), CORS misconfiguration, cookie security flags (Secure, HttpOnly, SameSite), directory listing detection. Triggers: 'config hardening', 'security headers', 'header audit', 'hsts check', 'debug endpoint', 'env file exposure', 'backup file disclosure', 'cors misconfiguration', 'cookie flags', 'tls audit', 'security posture'."
---

# Tech — Config Hardening Review

Security headers, TLS, debug endpoints, file exposure, CORS, cookies.

## Install

```bash
pip install requests --break-system-packages
apt-get install testssl.sh curl
```

---

## Phase 1: Security Headers

```bash
TARGET="https://TARGET"

# Capture headers:
curl -sk -I "$TARGET" | tee /workspace/output/TARGET_headers.txt

# Check for missing security headers:
python3 << 'EOF'
import requests, sys
resp = requests.get(sys.argv[1], verify=False, timeout=10)
headers = {k.lower(): v for k, v in resp.headers.items()}

REQUIRED = {
    'content-security-policy': 'CSP — prevents XSS',
    'strict-transport-security': 'HSTS — forces HTTPS',
    'x-frame-options': 'Clickjacking protection',
    'x-content-type-options': 'MIME-type sniffing prevention',
    'referrer-policy': 'Controls referrer header',
    'permissions-policy': 'Feature policy control',
}
FORBIDDEN = {
    'x-powered-by': 'Reveals tech stack',
    'server': 'Reveals server version',
    'x-aspnet-version': 'Reveals ASP.NET version',
}

print("[Security Headers]")
for h, desc in REQUIRED.items():
    status = "✓" if h in headers else "✗ MISSING"
    print(f"  {status} {h}: {desc}")

print("\n[Info Leakage Headers]")
for h, desc in FORBIDDEN.items():
    if h in headers:
        print(f"  [!] {h}: {headers[h]} ({desc})")
EOF
python3 /dev/stdin "$TARGET" < /dev/stdin \
    | tee /workspace/output/TARGET_header_audit.txt
```

---

## Phase 2: TLS/SSL Check

```bash
TARGET_HOST="target.com"
TARGET_PORT=443

# testssl.sh (comprehensive):
testssl.sh --severity HIGH --quiet "$TARGET_HOST:$TARGET_PORT" \
    | tee /workspace/output/TARGET_tls_audit.txt

# Quick nmap check:
nmap --script ssl-enum-ciphers -p 443 "$TARGET_HOST" \
    | tee /workspace/output/TARGET_ssl_ciphers.txt

# Check for weak protocols:
echo | openssl s_client -connect "$TARGET_HOST:$TARGET_PORT" \
    -ssl3 2>&1 | grep "SSL-Session\|alert handshake\|wrong version"
echo | openssl s_client -connect "$TARGET_HOST:$TARGET_PORT" \
    -tls1 2>&1 | grep "Protocol\|Cipher"

# Certificate expiry:
echo | openssl s_client -connect "$TARGET_HOST:$TARGET_PORT" 2>/dev/null \
    | openssl x509 -noout -dates -subject -issuer
```

---

## Phase 3: Debug Endpoint Enumeration

```bash
TARGET="https://TARGET"

# Common debug endpoints:
DEBUG_PATHS=(
    # Spring Boot Actuator:
    "/actuator" "/actuator/env" "/actuator/health" "/actuator/info"
    "/actuator/metrics" "/actuator/beans" "/actuator/mappings"
    "/actuator/configprops" "/actuator/loggers" "/actuator/heapdump"
    "/actuator/threaddump" "/actuator/httptrace"
    # Generic:
    "/.env" "/debug" "/debug/pprof" "/debug/vars" "/metrics"
    "/info" "/health" "/status" "/version" "/api-docs"
    # PHP:
    "/phpinfo.php" "/info.php" "/test.php"
    # Django/Python:
    "/__debug__/" "/silk/" "/admin/"
    # Swagger/OpenAPI:
    "/swagger-ui.html" "/swagger-ui/" "/api/swagger.json"
    "/v2/api-docs" "/v3/api-docs" "/openapi.json"
    # Error pages:
    "/error" "/errors" "/trace"
)

for path in "${DEBUG_PATHS[@]}"; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" "$TARGET$path")
    if [[ "$code" != "404" && "$code" != "000" ]]; then
        echo "[$code] $TARGET$path"
    fi
done | tee /workspace/output/TARGET_debug_endpoints.txt
```

---

## Phase 4: Sensitive File Exposure

```bash
TARGET="https://TARGET"

# Config and backup files:
SENSITIVE_FILES=(
    "/.env" "/.env.bak" "/.env.old" "/.env.prod" "/.env.local"
    "/config.php" "/config.php.bak" "/wp-config.php" "/wp-config.php.bak"
    "/database.yml" "/database.yml.bak" "/settings.py" "/settings.py.bak"
    "/application.yml" "/application.properties"
    "/backup.sql" "/dump.sql" "/db.sql" "/backup.tar.gz"
    "/.git/config" "/.git/HEAD" "/.svn/entries"
    "/composer.json" "/package.json" "/requirements.txt" "/Gemfile"
    "/Dockerfile" "/docker-compose.yml" "/Makefile"
    "/.htpasswd" "/.htaccess"
    "/robots.txt" "/sitemap.xml"
    "/crossdomain.xml" "/clientaccesspolicy.xml"
)

for file in "${SENSITIVE_FILES[@]}"; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" "$TARGET$file")
    if [[ "$code" == "200" ]]; then
        size=$(curl -sk -w "%{size_download}" -o /dev/null "$TARGET$file")
        echo "[200/$size] $TARGET$file"
    fi
done | tee /workspace/output/TARGET_sensitive_files.txt

# Check for directory listing:
for dir in "/" "/uploads/" "/backup/" "/files/" "/static/" "/assets/"; do
    resp=$(curl -sk "$TARGET$dir")
    if echo "$resp" | grep -qi "Index of\|Directory listing"; then
        echo "[DIRLIST] $TARGET$dir"
    fi
done
```

---

## Phase 5: CORS Misconfiguration

```bash
TARGET="https://TARGET"
ORIGIN="https://evil.attacker.com"

# Test reflected origin:
curl -sk -I -H "Origin: $ORIGIN" "$TARGET/api" | grep -i "access-control"

# Test null origin:
curl -sk -I -H "Origin: null" "$TARGET/api" | grep -i "access-control"

# Test subdomain bypass:
curl -sk -I -H "Origin: https://evil.${TARGET#https://}" "$TARGET/api" | grep -i "access-control"

python3 << 'EOF'
import requests, sys
target = sys.argv[1]

test_origins = [
    "https://evil.attacker.com",
    "null",
    f"https://evil.{target.replace('https://','').replace('http://','')}",
    f"https://{target.replace('https://','').replace('http://','')}@evil.com",
]

for origin in test_origins:
    try:
        r = requests.get(target, headers={'Origin': origin}, verify=False, timeout=5)
        acao = r.headers.get('Access-Control-Allow-Origin', 'not set')
        acac = r.headers.get('Access-Control-Allow-Credentials', 'not set')
        if acao != 'not set':
            print(f"Origin: {origin}")
            print(f"  ACAO: {acao}")
            print(f"  ACAC: {acac}")
            if acao == origin and acac == 'true':
                print("  *** VULNERABLE: reflected origin with credentials ***")
    except: pass
EOF
python3 /dev/stdin "$TARGET/api" < /dev/stdin
```

---

## Phase 6: Cookie Security Flags

```bash
TARGET="https://TARGET"

# Capture cookies:
curl -sk -c cookies.txt "$TARGET/login" -X POST \
    -d "username=test&password=test" -D headers.txt

# Analyze flags:
python3 << 'EOF'
import http.cookiejar, requests, sys, warnings
warnings.filterwarnings('ignore')

resp = requests.get(sys.argv[1], verify=False, allow_redirects=True)
for cookie in resp.cookies:
    issues = []
    if not cookie.secure: issues.append('Missing Secure flag')
    if not cookie.has_nonstandard_attr('HttpOnly'): issues.append('Missing HttpOnly')
    same = cookie._rest.get('SameSite', None)
    if not same: issues.append('Missing SameSite')
    elif same.lower() == 'none': issues.append('SameSite=None (check Secure)')

    status = "[!] " if issues else "[✓]"
    print(f"{status} {cookie.name}")
    for issue in issues:
        print(f"     - {issue}")
EOF
python3 /dev/stdin "$TARGET" < /dev/stdin
```

---

## Phase 7: Error Message Detection

```bash
TARGET="https://TARGET"

# Trigger errors to detect verbosity:
test_paths=(
    "/'\"" "/admin/../../etc/passwd" "/%3c%73%63%72%69%70%74%3e"
    "/api/test?id='" "/api/test?id=1 AND 1=1"
)

for path in "${test_paths[@]}"; do
    resp=$(curl -sk "$TARGET$path" -H "Accept: text/html")
    if echo "$resp" | grep -qiE "stacktrace|exception|error at line|syntax error|traceback|django.db|ActiveRecord|java.lang"; then
        echo "[VERBOSE ERROR] $TARGET$path"
        echo "$resp" | grep -iE "stacktrace|exception|error" | head -3
    fi
done | tee /workspace/output/TARGET_error_disclosure.txt
```

---

## Output

Save to `/workspace/output/`:
- `TARGET_headers.txt` — raw response headers
- `TARGET_header_audit.txt` — missing/present security headers
- `TARGET_tls_audit.txt` — TLS configuration findings
- `TARGET_debug_endpoints.txt` — accessible debug endpoints
- `TARGET_sensitive_files.txt` — exposed sensitive files
- `TARGET_error_disclosure.txt` — verbose error pages

## Next Phase

→ `tech-stack-fingerprint` for technology identification
→ `vuln-exploit-validation` for finding exploitable issues
