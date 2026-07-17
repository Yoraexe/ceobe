---
name: recon-js-analysis
description: "JavaScript analysis skill for SPA reconnaissance. Extracts API endpoints, hardcoded secrets, internal hostnames, and authentication tokens from client-side JavaScript bundles. Triggers: 'js analysis', 'javascript recon', 'api endpoint extraction', 'js secret scanning', 'spa recon', 'webpack bundle analysis', 'js endpoint discovery', 'hardcoded secrets'."
---

# JavaScript Analysis & Endpoint Extraction

Modern SPAs (React, Vue, Angular, Next.js) expose API routes and sometimes credentials within client-side code. Systematic extraction surfaces hidden attack surface.

## Phase 1: Collect JavaScript Files

```bash
TARGET="https://<target>"

# Extract JS file URLs from HTML source
curl -s "$TARGET" | grep -oE '(src|href)="[^"]*\.js[^"]*"' | \
  grep -oE '"[^"]*"' | tr -d '"' | \
  sed "s|^/|$TARGET/|" | sort -u > js_urls.txt

# Check for webpack manifest / chunk references
curl -s "$TARGET/asset-manifest.json" 2>/dev/null | jq -r '.files | to_entries[] | .value' >> js_urls.txt
curl -s "$TARGET/static/js/manifest.json" 2>/dev/null | jq -r '.[]' >> js_urls.txt

# Crawl for additional JS
# gospider
gospider -s "$TARGET" -t 10 --js -q | grep "\.js" >> js_urls.txt

# hakrawler
echo "$TARGET" | hakrawler -js -d 2 | grep "\.js" >> js_urls.txt

wc -l js_urls.txt
sort -u js_urls.txt > js_urls_dedup.txt
```

## Phase 2: Download JavaScript Files

```bash
mkdir -p js_dump
while IFS= read -r url; do
  filename=$(echo "$url" | md5sum | cut -d' ' -f1).js
  curl -s -o "js_dump/$filename" "$url"
  echo "$url -> $filename" >> js_url_map.txt
done < js_urls_dedup.txt

echo "Downloaded $(ls js_dump/*.js | wc -l) JS files"
```

## Phase 3: API Endpoint Extraction

```bash
# Extract API paths (double quotes, single quotes, template literals)
grep -rohE '"(/api/[^"]+)"' js_dump/ | tr -d '"' | sort -u > endpoints_dq.txt
grep -rohE "'(/api/[^']+)'" js_dump/ | tr -d "'" | sort -u > endpoints_sq.txt
grep -rohE '`(/api/[^`]+)`' js_dump/ | tr -d '`' | sort -u > endpoints_tl.txt

# Extract fetch/axios/XMLHttpRequest calls
grep -rohE "(fetch|axios\.(get|post|put|delete|patch))\(['\`\"]([^'\`\"]+)['\`\"]" js_dump/ | \
  grep -oE "['\`\"][^'\`\"]{5,}['\`\"]" | tr -d "'\`\"" | grep "/" | sort -u > endpoints_fetch.txt

# React Router / Vue Router / Angular routes
grep -rohE '"path":\s*"([^"]+)"' js_dump/ | grep -oE '"[^"]+"' | tail -n +1 | tr -d '"' | sort -u > routes_react.txt
grep -rohE "path:\s*['\`\"]([^'\`\"]+)['\`\"]" js_dump/ | grep -oE "['\`\"][^'\`\"]+['\`\"]" | tr -d "'\`\"" | sort -u >> routes_react.txt

cat endpoints_*.txt routes_*.txt | sort -u > all_endpoints.txt
wc -l all_endpoints.txt
```

## Phase 4: Secret Scanning

```bash
# API keys / tokens
grep -rohE "(api[_-]?key|apikey|api[_-]?token|access[_-]?token|secret[_-]?key|private[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]" js_dump/ > secrets_api.txt

# AWS credentials
grep -rohE "AKIA[0-9A-Z]{16}" js_dump/ > secrets_aws_key.txt
grep -rohE "['\"][0-9a-zA-Z/+]{40}['\"]" js_dump/ > secrets_aws_secret.txt

# Auth tokens
grep -rohE "(bearer|Bearer)\s+[a-zA-Z0-9._-]{20,}" js_dump/ > secrets_bearer.txt
grep -rohE "eyJ[a-zA-Z0-9._-]{30,}" js_dump/ > secrets_jwt.txt  # JWT pattern

# Firebase / Google
grep -rohE "AIza[0-9A-Za-z_-]{35}" js_dump/ > secrets_firebase.txt

# Internal hostnames / private IPs
grep -rohE "https?://([a-z0-9._-]+(\.internal|\.local|\.corp|\.lan|\.intranet))" js_dump/ > secrets_internal.txt
grep -rohE "(10\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.[0-9]{1,3}\.[0-9]{1,3}" js_dump/ > secrets_private_ips.txt

# Passwords in variables
grep -rohE "(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{6,}['\"]" js_dump/ > secrets_passwords.txt

# Filter out CDN/analytics false positives
grep -v "googletagmanager\|google-analytics\|doubleclick\|cloudfront\|fastly\|akamai" \
  secrets_api.txt > secrets_api_filtered.txt

echo "=== Secret scan results ==="
wc -l secrets_*.txt
```

## Phase 5: Framework-Specific Extraction

**Next.js:**
```bash
# API routes (file-based routing)
grep -rohE '"pathname":\s*"([^"]+)"' js_dump/ | grep -oE '"[^"]+"' | tr -d '"'
# Next.js data endpoints
curl -s "$TARGET/_next/static/chunks/pages/*.js" 2>/dev/null | grep -oE '"/api/[^"]+"'
```

**React Router:**
```bash
grep -rohE '<Route[^>]+path=["\x27]([^"\x27]+)' js_dump/ | grep -oE '"[^"]+"\|'"'"'[^'"'"']+'"'" | tr -d '"'"'"
grep -rohE 'path:\s*["\x27]([^"\x27]+)' js_dump/ | grep -oE '"[^"]+"\|'"'"'[^'"'"']+'"'" | tr -d '"'"'"
```

**Angular:**
```bash
grep -rohE "loadChildren:\s*['\"]([^'\"]+)['\"]" js_dump/ | tr -d "'\""
grep -rohE "component:\s*[A-Za-z]+,\s*path:\s*['\"]([^'\"]+)['\"]" js_dump/ | grep -oE "['\"][^'\"]+['\"]" | tr -d "'\""
```

## Phase 6: Endpoint Validation

```bash
# Probe discovered endpoints
while IFS= read -r endpoint; do
  # Unauthenticated
  status=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$endpoint")
  echo "$status $endpoint"
  
  # Authenticated
  auth_status=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$endpoint" \
    -H "Authorization: Bearer <token>")
  echo "AUTH:$auth_status $endpoint"
done < all_endpoints.txt | grep -E "^(200|201|204|301|302|403|500)" | sort

# Filter for interesting results
grep -E "^(200|201)" endpoint_probe.txt > endpoints_accessible.txt
grep "^403" endpoint_probe.txt > endpoints_forbidden.txt  # Auth-required — may have IDOR
```

## Validation (REQUIRED before reporting)

Document all discovered findings:
1. **API endpoints**: List of non-public endpoints accessible unauthenticated
2. **Secrets**: Each credential type found, severity, and where used (mark any already-rotated)
3. **Internal hostnames**: Confirmed internal-only domains/IPs exposing infrastructure topology
4. **IDOR candidates**: Endpoint paths containing ID parameters (`/api/user/{id}`, `/api/order/{id}`)

Confidence threshold ≥0.70 required. Confirm each credential is current (not example/placeholder) before reporting.
