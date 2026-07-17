---
name: recon-shodan
description: "Shodan, Censys, FOFA passive reconnaissance. ASN enumeration, IP range discovery, favicon hashing, internet-wide scanning, exposed service discovery. Triggers: 'censys', 'shodan search', 'censys search', 'asn enumeration', 'ip range discovery', 'internet scan', 'fofa', 'shodan cli', 'censys api', 'passive recon', 'favicon hash', 'favicon fingerprint', 'shodan favicon', 'mmh3 hash'."
---

# Shodan / Censys / FOFA — Passive Reconnaissance

Discover target infrastructure passively via internet-wide scan databases. No active probes — zero detection risk.

## Install

```bash
pip install shodan censys mmh3 requests --break-system-packages

# Set API keys:
shodan init YOUR_SHODAN_API_KEY
export CENSYS_API_ID="your-id"
export CENSYS_API_SECRET="your-secret"
```

---

## Phase 1: ASN & IP Range Enumeration

```bash
TARGET_ORG="Target Company"
TARGET_DOMAIN="target.com"

# Find ASN from org name (bgp.he.net):
curl -s "https://bgp.he.net/search?search%5Bsearch%5D=$TARGET_ORG&commit=Search" \
  | grep -oP "AS\d+" | sort -u

# Get IP ranges from ASN:
ASN="AS12345"
curl -s "https://api.hackertarget.com/aslookup/?q=$ASN"
whois -h whois.radb.net -- "-i origin $ASN" | grep "^route:"

# Shodan ASN search:
shodan search "org:\"$TARGET_ORG\"" --fields ip_str,port,org,hostnames | head -50
shodan search "asn:$ASN" --fields ip_str,port,org,hostnames | head -50

# Censys ASN:
python3 -c "
import censys.search
c = censys.search.CensysHosts()
for host in c.search('autonomous_system.asn=12345', fields=['ip','services.port','services.service_name']):
    print(host)
"
```

---

## Phase 2: Shodan — Target Search

```bash
TARGET="target.com"

# Hostname search:
shodan search "hostname:$TARGET" --fields ip_str,port,org,hostnames,product

# SSL cert search (finds all IPs with target's SSL cert):
shodan search "ssl:\"$TARGET\"" --fields ip_str,port,org,hostnames,ssl.cert.subject.cn

# SSL org name (finds all certs issued to org):
shodan search "ssl.cert.subject.O:\"Target Company\"" --fields ip_str,port,hostnames,ssl.cert.subject.cn

# Find subdomains via Shodan:
shodan search "hostname:$TARGET" --fields hostnames | tr ',' '\n' | grep "$TARGET" | sort -u

# Search by technology:
shodan search "hostname:$TARGET http.component:\"nginx\"" --fields ip_str,port
shodan search "hostname:$TARGET product:\"Apache httpd\"" --fields ip_str,port,product

# Specific service searches:
shodan search "hostname:$TARGET port:3306"   # MySQL exposed
shodan search "hostname:$TARGET port:6379"   # Redis exposed
shodan search "hostname:$TARGET port:9200"   # Elasticsearch exposed
shodan search "hostname:$TARGET port:27017"  # MongoDB exposed
shodan search "hostname:$TARGET port:5432"   # PostgreSQL exposed

# API endpoint discovery:
shodan search "hostname:$TARGET http.title:\"API\"" --fields ip_str,port,http.title
```

---

## Phase 3: Favicon Hash — Find Hidden Assets

```bash
TARGET="https://target.com"

# Calculate favicon hash:
python3 -c "
import requests, mmh3, base64, sys

url = sys.argv[1] if len(sys.argv) > 1 else '$TARGET/favicon.ico'
try:
    r = requests.get(url, timeout=5, verify=False)
    favicon = base64.encodebytes(r.content)
    h = mmh3.hash(favicon)
    print(f'Favicon hash: {h}')
    print(f'Shodan query: http.favicon.hash:{h}')
    print(f'Censys query: services.http.response.favicons.md5_hash:<md5>')
except Exception as e:
    print(f'Error: {e}')
" $TARGET/favicon.ico

# Search Shodan for all hosts with same favicon (finds hidden assets):
HASH=$(python3 -c "
import requests, mmh3, base64
r = requests.get('$TARGET/favicon.ico', timeout=5, verify=False)
print(mmh3.hash(base64.encodebytes(r.content)))
")

shodan search "http.favicon.hash:$HASH" --fields ip_str,port,org,hostnames
```

---

## Phase 4: Censys — Advanced Search

```bash
# SSL/TLS certificate search:
python3 << 'EOF'
from censys.search import CensysHosts, CensysCerts
import os

# Search hosts:
h = CensysHosts()
query = 'services.tls.certificates.leaf_data.names: target.com'
for host in h.search(query, fields=['ip', 'services.port', 'services.service_name', 'services.tls']):
    print(f"{host['ip']} : {[s.get('port') for s in host.get('services', [])]}")

# Search certificates (finds all subdomains):
c = CensysCerts()
for cert in c.search('parsed.names: target.com', fields=['parsed.names', 'parsed.subject.organization']):
    for name in cert.get('parsed.names', []):
        if 'target.com' in name:
            print(name)
EOF

# CLI search:
censys search 'services.tls.certificates.leaf_data.names: target.com' \
  --index-type hosts --fields ip,services.port,services.service_name
```

---

## Phase 5: FOFA Search (Alternative)

```bash
# FOFA queries (requires API key — Chinese internet-wide scanner):
# More coverage than Shodan for Asian infrastructure

BASE64_QUERY=$(echo -n 'domain="target.com"' | base64)
curl -s "https://fofa.info/api/v1/search/all?email=EMAIL&key=KEY&qbase64=$BASE64_QUERY&fields=ip,port,title,domain"

# Common FOFA queries:
# domain="target.com"
# cert="target.com"
# org="Target Company"
# header="X-Custom-Header"   ← find by custom headers (proprietary frameworks)
# title="Target Login"
```

---

## Phase 6: Exposed Service Hunting

```bash
ORG="Target Company"

# High-value exposed services:
echo "=== Admin Panels ==="
shodan search "org:\"$ORG\" http.title:\"admin\|dashboard\|login\|console\"" \
  --fields ip_str,port,http.title

echo "=== Cloud Storage ==="
shodan search "org:\"$ORG\" http.title:\"S3\|MinIO\|Bucket\"" --fields ip_str,port,http.title

echo "=== Dev/Staging ==="
shodan search "org:\"$ORG\" hostname:\"dev\|staging\|test\|internal\|corp\"" \
  --fields ip_str,port,hostnames

echo "=== Database Ports ==="
for port in 3306 5432 6379 9200 27017 5984 8086; do
  shodan search "org:\"$ORG\" port:$port" --fields ip_str,port,product | head -5
done

echo "=== RDP/VPN/SSH ==="
shodan search "org:\"$ORG\" port:3389" --fields ip_str,port   # RDP
shodan search "org:\"$ORG\" port:1194" --fields ip_str,port   # OpenVPN
shodan search "org:\"$ORG\" port:22"   --fields ip_str,port   # SSH
```

---

## Phase 7: Historical Data & Change Detection

```bash
TARGET_IP="1.2.3.4"

# Historical host data:
shodan host $TARGET_IP --history

# All IPs that resolved to domain (via DNS history):
curl -s "https://api.hackertarget.com/hostsearch/?q=target.com"
curl -s "https://api.hackertarget.com/reverseiplookup/?q=$TARGET_IP"

# Certificate transparency for subdomain discovery:
curl -s "https://crt.sh/?q=%25.target.com&output=json" \
  | jq -r '.[].name_value' | sort -u | grep -v '\*'
```

---

## Output

Save to `.omop/engagement/recon/passive/`:
- `asn-ranges.txt` — IP ranges belonging to target
- `shodan-hosts.txt` — discovered hosts with ports
- `favicon-matches.txt` — assets found via favicon hash
- `exposed-services.txt` — high-value exposed services
- `subdomains-passive.txt` — subdomains from cert transparency + Shodan

## Next Phase

→ `pentest-recon` for active scanning of discovered assets
→ `pentest-enum` for service enumeration
