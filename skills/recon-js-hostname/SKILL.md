---
name: recon-js-hostname
description: "JavaScript internal hostname intelligence — extract internal hostnames, API endpoints, microservice URLs, cloud metadata endpoints, internal IP addresses from client-side JavaScript. Triggers: 'js hostname', 'internal hostname', 'javascript endpoint', 'api endpoint extraction', 'internal url js', 'microservice discovery', 'internal service js', 'js endpoint recon'."
---

# JavaScript Internal Hostname Intelligence

Extract internal service URLs, hostnames, and API endpoints from client-side JavaScript.

---

## Phase 1: JavaScript Collection

```bash
TARGET="https://TARGET"

# Collect all JS file URLs:
gau "$TARGET" 2>/dev/null | grep -iE '\.js(\?|$)' | sort -u > /tmp/js_urls.txt
curl -s "$TARGET/" | grep -oE 'src="[^"]*\.js[^"]*"' | sed 's/src="//;s/"//' | \
  awk -v base="$TARGET" '{if($0 ~ /^http/) print $0; else print base$0}' >> /tmp/js_urls.txt
sort -u /tmp/js_urls.txt -o /tmp/js_urls.txt

# Download JS files:
mkdir -p /tmp/js_analysis
while IFS= read -r URL; do
  FNAME=$(echo "$URL" | md5sum | cut -d' ' -f1).js
  curl -s "$URL" > "/tmp/js_analysis/$FNAME"
done < /tmp/js_urls.txt
```

---

## Phase 2: Internal URL Extraction

```bash
# Extract internal hostnames and IPs:
grep -rhoE '"[a-zA-Z0-9._-]+\.(internal|local|corp|lan|priv|intranet|infra)[^"]*"' \
  /tmp/js_analysis/ | sort -u | tee output/internal_hostnames.txt

# Extract all URLs from JS:
grep -rhoE '"https?://[^"]{5,}"' /tmp/js_analysis/ | tr -d '"' | \
  sort -u | tee output/js_urls_extracted.txt

# Extract API base URLs:
grep -rhoE '"https?://[a-zA-Z0-9._-]+\.(com|io|net|org|cloud|aws|azure|gcp)[/][^"]*"' \
  /tmp/js_analysis/ | tr -d '"' | sort -u | tee output/api_bases.txt

# Find internal IPs:
grep -rhoE '"(10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)(:[0-9]+)?(/[^"]*)?"' \
  /tmp/js_analysis/ | sort -u | tee output/internal_ips.txt
```

---

## Phase 3: API Path Extraction

```bash
# Extract REST API paths:
grep -rhoE '"(/api/v[0-9]+/[a-zA-Z0-9/_-]+|/v[0-9]+/[a-zA-Z0-9/_-]+)"' \
  /tmp/js_analysis/ | tr -d '"' | sort -u | tee output/api_paths_js.txt

# Extract GraphQL queries:
grep -rhoE 'query\s+[A-Z][a-zA-Z]+\s*\{[^}]+\}' /tmp/js_analysis/ | \
  sort -u | tee output/graphql_queries_js.txt

# Extract environment configs:
grep -rhoE '"(REACT_APP|NEXT_PUBLIC|VUE_APP|VITE_)[A-Z_]+":\s*"[^"]+"' \
  /tmp/js_analysis/ | sort -u | tee output/env_vars_js.txt

# Find feature flags and hidden features:
grep -rhoE '"feature_flag[^"]*":\s*(true|false)' /tmp/js_analysis/ | sort -u
grep -rhoE '"enable[d]?[^"]*":\s*(true|false)' /tmp/js_analysis/ | sort -u
```

---

## Phase 4: Webpack & Bundle Analysis

```bash
TARGET="https://TARGET"

# Check for Webpack bundle analyzer:
curl -s "$TARGET/report.html" | head -5
curl -s "$TARGET/webpack-stats.json" | jq '.modules[].name' 2>/dev/null | head -20

# Extract chunk URLs for additional JS:
curl -s "$TARGET/static/js/main.chunk.js" | grep -oE '"[0-9a-f]{8}\.chunk\.js"' | \
  awk -v base="$TARGET/static/js/" '{print base substr($0,2,length($0)-2)}'

# Sourcemap reconstruction (if maps exposed):
cat output/sourcemaps.txt 2>/dev/null | head -20
```

---

## Output

Save to `output/`:
- `internal_hostnames.txt` — internal domain names found in JS
- `js_urls_extracted.txt` — all URLs extracted from JS
- `api_paths_js.txt` — API endpoint paths from JS
- `internal_ips.txt` — internal IP addresses found

## Next Phase

→ `recon-full` to enumerate discovered endpoints
→ `vuln-ssrf` if internal service URLs found
