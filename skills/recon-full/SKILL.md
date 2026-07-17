---
name: recon-full
description: "Comprehensive full reconnaissance methodology — passive intel, subdomain enumeration, live host detection, port scanning, tech stack fingerprinting, JS analysis, secret hunting. Triggers: 'full recon', 'comprehensive recon', 'full reconnaissance', 'complete recon', 'end to end recon', 'full scope recon', 'recon methodology', 'start recon', 'bug bounty recon'."
---

# Full Reconnaissance Methodology

Systematic end-to-end attack surface discovery for penetration testing.

---

## Phase 1: Passive Intelligence

```bash
TARGET="target.com"
mkdir -p output

# Subdomain discovery (passive):
subfinder -d "$TARGET" -all -recursive -silent | tee output/subdomains.txt
amass enum -passive -d "$TARGET" 2>/dev/null >> output/subdomains.txt
assetfinder --subs-only "$TARGET" 2>/dev/null >> output/subdomains.txt
sort -u output/subdomains.txt -o output/subdomains.txt
echo "[+] Subdomains found: $(wc -l < output/subdomains.txt)"

# Historical URLs:
gau --subs "$TARGET" 2>/dev/null | sort -u | tee output/historical_urls.txt
waybackurls "$TARGET" 2>/dev/null >> output/historical_urls.txt
sort -u output/historical_urls.txt -o output/historical_urls.txt

# Certificate transparency:
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" | jq -r '.[].name_value' | \
  sed 's/\*\.//g' | sort -u >> output/subdomains.txt
sort -u output/subdomains.txt -o output/subdomains.txt
```

---

## Phase 2: Live Host Detection

```bash
TARGET="target.com"

# DNS resolution:
dnsx -l output/subdomains.txt -a -resp -silent -o output/resolved.txt 2>/dev/null
echo "[+] Resolved: $(wc -l < output/resolved.txt)"

# HTTP probing:
httpx -l output/subdomains.txt -silent -title -status-code -tech-detect \
  -o output/live_hosts.txt 2>/dev/null
echo "[+] Live hosts: $(wc -l < output/live_hosts.txt)"

# Port scanning (fast):
naabu -l output/subdomains.txt -p 80,443,8080,8443,8000,8888,3000,5000,9000 \
  -silent -o output/open_ports.txt 2>/dev/null
```

---

## Phase 3: Technology Fingerprinting

```bash
TARGET="target.com"

# Technology detection per host:
httpx -l output/live_hosts.txt -tech-detect -json -silent -o output/tech_stack.json 2>/dev/null

# Wappalyzer via whatweb:
while IFS= read -r HOST; do
  HOST_URL=$(echo "$HOST" | awk '{print $1}')
  whatweb -q --no-errors "$HOST_URL" 2>/dev/null | tee -a output/whatweb.txt
done < output/live_hosts.txt

# Check security headers:
while IFS= read -r HOST; do
  HOST_URL=$(echo "$HOST" | awk '{print $1}')
  curl -s -I "$HOST_URL" | grep -iE "strict-transport|content-security|x-frame-options|server:|x-powered-by" | \
    awk -v host="$HOST_URL" '{print host" | "$0}'
done < output/live_hosts.txt | tee output/security_headers.txt
```

---

## Phase 4: URL & Parameter Collection

```bash
TARGET="target.com"

# Collect all URLs with parameters:
cat output/historical_urls.txt | grep '=' | sort -u | tee output/param_urls.txt

# Filter by potential vulnerability class:
cat output/param_urls.txt | grep -iE '(url|redirect|next|goto)=' > output/candidates_redirect.txt
cat output/param_urls.txt | grep -iE '(q|search|query|s)=' > output/candidates_xss.txt
cat output/param_urls.txt | grep -iE '(id|uid|user_id|account|order)=' > output/candidates_idor.txt
cat output/param_urls.txt | grep -iE '(file|path|dir|document|doc|read|include|require|load)=' > output/candidates_lfi.txt
cat output/param_urls.txt | grep -iE '(url|src|dest|fetch|link|image|proxy|host)=' > output/candidates_ssrf.txt

echo "XSS candidates: $(wc -l < output/candidates_xss.txt)"
echo "IDOR candidates: $(wc -l < output/candidates_idor.txt)"
echo "LFI candidates: $(wc -l < output/candidates_lfi.txt)"
echo "SSRF candidates: $(wc -l < output/candidates_ssrf.txt)"
```

---

## Phase 5: Secret Hunting

```bash
TARGET="target.com"

# Scan JS files for secrets:
cat output/historical_urls.txt | grep -iE '\.js(\?|$)' | sort -u > /tmp/js_files.txt
while IFS= read -r JS_URL; do
  curl -s "$JS_URL" | grep -iE '(api_key|apikey|secret|password|token|aws_|stripe_|twilio_|github_token)["\s]*[=:]["\s]*[a-zA-Z0-9_\-]{20,}' | \
    awk -v url="$JS_URL" '{print url": "$0}'
done < /tmp/js_files.txt | tee output/js_secrets.txt

# GitHub dork for secrets:
# site:github.com "target.com" password
# site:github.com "target.com" api_key
```

---

## Output

Save to `output/`:
- `subdomains.txt` — all discovered subdomains
- `live_hosts.txt` — live hosts with status codes
- `tech_stack.json` — technology fingerprinting
- `candidates_*.txt` — vulnerability class candidates

## Next Phase

→ `recon-js-analysis` for deep JavaScript analysis
→ `vuln-api-testing` for API security testing
→ `pentest-enum` for service enumeration
