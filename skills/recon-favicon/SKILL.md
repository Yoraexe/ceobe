---
name: recon-favicon
description: "Favicon hash fingerprinting for asset discovery. MurmurHash3 (mmh3) computation of favicon.ico from target URLs, Shodan http.favicon.hash search, FOFA icon_hash search, Censys favicon hash search, httpx live verification of discovered assets. Triggers: 'favicon hash', 'favicon fingerprint', 'shodan favicon', 'fofa icon hash', 'mmh3 hash', 'asset discovery favicon', 'infrastructure enumeration favicon'."
---

# Recon — Favicon Hash Fingerprinting

Compute mmh3 hash → search Shodan/FOFA/Censys → verify live assets.

## Install

```bash
pip install mmh3 requests --break-system-packages
```

---

## Phase 1: Compute Favicon Hash

```bash
mkdir -p /workspace/output

cat > /workspace/output/favicon_hash.py << 'PY'
import base64, mmh3, requests, sys, warnings
warnings.filterwarnings('ignore')

TARGET = sys.argv[1].rstrip('/')
PATHS = [
    '/favicon.ico',
    '/static/favicon.ico',
    '/assets/favicon.ico',
    '/images/favicon.ico',
    '/public/favicon.ico',
]

for path in PATHS:
    try:
        resp = requests.get(TARGET + path, timeout=10, verify=False)
        if resp.status_code == 200 and len(resp.content) > 0:
            favicon_b64 = base64.encodebytes(resp.content)
            h = mmh3.hash(favicon_b64)
            print(f"[+] {path}: hash={h} ({len(resp.content)} bytes)")
        else:
            print(f"[-] {path}: {resp.status_code}")
    except Exception as e:
        print(f"[!] {path}: {e}")
PY

python3 /workspace/output/favicon_hash.py "https://TARGET" \
    | tee /workspace/output/TARGET_favicon_hashes.txt
```

---

## Phase 2: Search Engines

```bash
HASH="-XXXXXXXXX"  # from Phase 1 output

# Shodan:
shodan search "http.favicon.hash:$HASH" --fields ip_str,port,hostnames \
    | tee /workspace/output/TARGET_shodan_favicon.txt

# Shodan dork in browser:
echo "Shodan: http.favicon.hash:$HASH"

# FOFA query syntax:
echo "FOFA: icon_hash=\"$HASH\""
echo "FOFA with country: icon_hash=\"$HASH\" && country=\"US\""
echo "FOFA with port: icon_hash=\"$HASH\" && port=\"443\""

# Censys (search.censys.io):
echo "Censys: services.http.response.favicons.hashes:\"sha256:HASH_HERE\""
# Note: Censys uses SHA256, not mmh3 — compute separately if needed:
python3 -c "
import hashlib, base64, requests, sys, warnings; warnings.filterwarnings('ignore')
resp = requests.get(sys.argv[1] + '/favicon.ico', verify=False)
sha256 = hashlib.sha256(resp.content).hexdigest()
print('SHA256:', sha256)
" "https://TARGET"

# Hunter.io / ZoomEye:
echo "ZoomEye: iconhash:$HASH"
```

---

## Phase 3: Verify Live Assets

```bash
# Extract IPs from Shodan results:
awk '{print $1":"$2}' /workspace/output/TARGET_shodan_favicon.txt \
    > /workspace/output/favicon_hosts.txt

# Verify with httpx:
httpx -l /workspace/output/favicon_hosts.txt \
    -silent -title -status-code -favicon \
    -o /workspace/output/TARGET_favicon_live.txt

# Filter confirmed matches:
grep -v "404\|403" /workspace/output/TARGET_favicon_live.txt \
    | tee /workspace/output/TARGET_favicon_confirmed.txt
```

---

## Phase 4: Tech Stack from Favicon

```bash
# Favicon → known product:
# Hash database: https://github.com/sansatart/scrapts/blob/master/shodan-favicon-hashes.csv

python3 << 'EOF'
KNOWN_HASHES = {
    116323821: "Grafana",
    -247388890: "Jenkins",
    1073741824: "Kibana",
    -1555533817: "GitLab",
    1618797313: "Jira",
    -471736142: "phpMyAdmin",
    -150751098: "Jupyter Notebook",
    1028228059: "Cisco",
    915816449: "F5 BIG-IP",
}

import sys
h = int(sys.argv[1]) if len(sys.argv) > 1 else 0
product = KNOWN_HASHES.get(h, "Unknown")
print(f"Hash {h} → {product}")
EOF

# Full hash → tech mapping via online lookup:
# https://faviconhash.com/
```

---

## Output

Save to `/workspace/output/`:
- `TARGET_favicon_hashes.txt` — computed hashes per path
- `TARGET_shodan_favicon.txt` — Shodan results
- `TARGET_favicon_live.txt` — verified live assets
- `TARGET_favicon_confirmed.txt` — confirmed matching assets

## Report Template

```
Target: TARGET
Date: DATE

## Findings
- Favicon hash: HASH (mmh3)
- Shodan results: N hosts
- Live confirmed: N hosts

## Hidden Assets
- IP:PORT — title — server
- IP:PORT — title — server

## Recommendations
1. Rotate/change favicon to prevent fingerprinting
2. Restrict admin interfaces to known IPs
3. Monitor Shodan for new indexed assets
```

## Next Phase

→ `recon-subdomain` for subdomain enumeration
→ `tech-stack-fingerprint` for full technology identification
