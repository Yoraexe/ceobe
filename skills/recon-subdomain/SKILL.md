---
name: recon-subdomain
description: "Subdomain enumeration. subfinder, assetfinder, amass passive, dnsx resolution, httpx live service detection, permutation/brute-force, high-value subdomain prioritization. Triggers: 'subdomain enumeration', 'subdomain discovery', 'subdomain recon', 'subfinder', 'amass', 'assetfinder', 'dns enumeration', 'dnsx', 'subdomains', 'subdomain scan'."
---

# Subdomain Enumeration

Passive discovery → resolution → live HTTP validation → prioritization.

## Install

```bash
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install -v github.com/tomnomnom/assetfinder@latest
go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# amass:
go install -v github.com/owasp-amass/amass/v4/...@master@latest
# OR: apt-get install -y amass

# Permutation:
go install -v github.com/d3mondev/puredns/v2@latest
pip install dnsgen --break-system-packages
```

---

## Phase 1: Passive Enumeration

```bash
TARGET="target.com"
OUTPUT=".omop/engagement/recon/subdomains"
mkdir -p "$OUTPUT"

# subfinder (fast, API-based):
subfinder -d "$TARGET" -all -o "$OUTPUT/subfinder.txt" -v
echo "[+] subfinder: $(wc -l < $OUTPUT/subfinder.txt) results"

# assetfinder (certificate transparency + passive):
assetfinder --subs-only "$TARGET" > "$OUTPUT/assetfinder.txt"
echo "[+] assetfinder: $(wc -l < $OUTPUT/assetfinder.txt) results"

# amass (most comprehensive passive):
amass enum -passive -d "$TARGET" -o "$OUTPUT/amass.txt" 2>/dev/null
echo "[+] amass: $(wc -l < $OUTPUT/amass.txt) results"

# Certificate transparency:
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" \
  | jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u \
  > "$OUTPUT/crtsh.txt"
echo "[+] crt.sh: $(wc -l < $OUTPUT/crtsh.txt) results"

# Merge and deduplicate:
cat "$OUTPUT"/*.txt | sort -u > "$OUTPUT/all-subs.txt"
echo "[+] Total unique: $(wc -l < $OUTPUT/all-subs.txt)"
```

---

## Phase 2: Brute-Force / Permutation (Optional)

```bash
TARGET="target.com"
OUTPUT=".omop/engagement/recon/subdomains"

# Wordlist-based brute-force:
WORDLIST="/usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt"

# puredns brute-force (fast + valid DNS):
puredns bruteforce "$WORDLIST" "$TARGET" \
  --resolvers /usr/share/seclists/Miscellaneous/dns-resolvers.txt \
  -w "$OUTPUT/bruteforce.txt"

# Generate permutations from known subs:
cat "$OUTPUT/all-subs.txt" | dnsgen - > "$OUTPUT/permutations.txt"

# Resolve permutations:
puredns resolve "$OUTPUT/permutations.txt" \
  --resolvers /usr/share/seclists/Miscellaneous/dns-resolvers.txt \
  -w "$OUTPUT/permutations-resolved.txt"

# Merge all results:
cat "$OUTPUT/all-subs.txt" "$OUTPUT/bruteforce.txt" "$OUTPUT/permutations-resolved.txt" \
  | sort -u > "$OUTPUT/all-final.txt"
```

---

## Phase 3: DNS Resolution

```bash
TARGET="target.com"
OUTPUT=".omop/engagement/recon/subdomains"

# Resolve all discovered subdomains:
dnsx -l "$OUTPUT/all-final.txt" -o "$OUTPUT/resolved.txt" -a -resp -silent

# Get IP addresses:
dnsx -l "$OUTPUT/all-final.txt" -a -resp-only -silent | sort -u > "$OUTPUT/ips.txt"

# Find wildcard DNS:
dnsx -d "$TARGET" -wc -silent
# → If wildcard exists, filter false positives from brute-force

echo "[+] Resolved: $(wc -l < $OUTPUT/resolved.txt)"
echo "[+] Unique IPs: $(wc -l < $OUTPUT/ips.txt)"
```

---

## Phase 4: Live Service Detection

```bash
OUTPUT=".omop/engagement/recon/subdomains"

# httpx — probe for live HTTP/HTTPS:
httpx -l "$OUTPUT/resolved.txt" \
  -o "$OUTPUT/live-http.txt" \
  -title -status-code -tech-detect -follow-redirects \
  -threads 50 -silent

# With additional metadata:
httpx -l "$OUTPUT/resolved.txt" \
  -json -o "$OUTPUT/live-http.json" \
  -title -status-code -content-length -web-server -tech-detect \
  -threads 50

echo "[+] Live hosts: $(wc -l < $OUTPUT/live-http.txt)"
```

---

## Phase 5: High-Value Target Prioritization

```bash
OUTPUT=".omop/engagement/recon/subdomains"

echo "=== HIGH VALUE SUBDOMAINS ==="

# Admin / internal panels:
grep -iE "admin|staging|dev|test|internal|vpn|jira|git|jenkins|gitlab|grafana|kibana|elastic|sonar|nexus|artifactory" \
  "$OUTPUT/live-http.txt" | tee "$OUTPUT/high-value.txt"

# Non-200 status codes (login pages, unauthorized):
cat "$OUTPUT/live-http.json" | jq -r 'select(.status_code == 401 or .status_code == 403) | .url' \
  | head -20

# Interesting technology stacks:
cat "$OUTPUT/live-http.json" | jq -r 'select(.technologies | length > 0) | "\(.url) → \(.technologies)"' \
  | grep -iE "wordpress|drupal|joomla|jenkins|grafana|elastic|mongo|redis" | head -20

# Old/legacy services (likely unpatched):
grep -iE "iis|apache/2\.[0-2]|nginx/1\.[0-9]\." "$OUTPUT/live-http.txt" | head -10
```

---

## Phase 6: Takeover Check

```bash
OUTPUT=".omop/engagement/recon/subdomains"

# subdomain takeover check via subjack or nuclei:
go install github.com/haccer/subjack@latest
subjack -w "$OUTPUT/all-final.txt" -t 50 -timeout 30 \
  -o "$OUTPUT/takeover.txt" -ssl -v 2>/dev/null

# nuclei subdomain takeover templates:
nuclei -l "$OUTPUT/live-http.txt" \
  -t http/takeovers/ \
  -o "$OUTPUT/nuclei-takeovers.txt"

# Manual check — unresolved CNAMEs to cloud services:
dnsx -l "$OUTPUT/all-final.txt" -cname -resp-only -silent | \
  grep -iE "github\.io|herokuapp|s3\.amazonaws|azurewebsites|cloudfront|elasticbeanstalk|surge\.sh|netlify\.app" | \
  tee "$OUTPUT/potential-takeovers.txt"
```

---

## Report Template

```markdown
## Subdomain Enumeration Results

**Target:** target.com
**Tools:** subfinder, assetfinder, amass, crt.sh, puredns
**Date:** $(date)

### Summary
- Total discovered: $(wc -l < all-final.txt)
- Resolved: $(wc -l < resolved.txt)
- Live HTTP services: $(wc -l < live-http.txt)
- High-value targets: $(wc -l < high-value.txt)

### High-Value Findings
[paste high-value.txt]

### Potential Takeovers
[paste potential-takeovers.txt]

### Recommendations
1. Disable/remove unused subdomains
2. Audit access controls on internal subdomains (admin, dev, staging)
3. Address any subdomain takeover candidates immediately
```

---

## Output

Save to `.omop/engagement/recon/subdomains/`:
- `all-final.txt` — all discovered subdomains
- `resolved.txt` — DNS-resolved with IPs
- `live-http.txt` — live HTTP services with titles
- `high-value.txt` — admin/dev/staging targets
- `takeover.txt` — subdomain takeover candidates

## Next Phase

→ `pentest-enum` for service enumeration on discovered hosts
→ `recon-shodan` for passive internet-wide data on discovered IPs
→ `pentest-recon` for active scanning of live services
