---
name: recon-dorking
description: "Google/Bing/DuckDuckGo dorking skill for passive OSINT reconnaissance. Discovers exposed credentials, sensitive files, admin panels, git repos, and attack surface via search engine operators. Triggers: 'dorking', 'google dork', 'dork', 'search engine recon', 'osint dork', 'exposed credentials', 'directory listing', 'filetype dork', 'site dork'."
---

# Dorking & Search Engine OSINT

Passive reconnaissance — leverages search engine operators to find exposed systems, sensitive files, and credentials without touching the target directly. Zero network footprint on target.

## Phase 1: Domain & Subdomain Mapping

```
site:<target.com>
site:<target.com> -www
site:<target.com> -www -mail -shop
site:<target.com> inurl:staging OR inurl:dev OR inurl:test OR inurl:uat
site:<target.com> inurl:api OR inurl:v1 OR inurl:v2
```

Tools:
```bash
# theHarvester
theHarvester -d <target.com> -b google,bing,duckduckgo,certspotter -f output.html

# Sublist3r with dork integration
python3 sublist3r.py -d <target.com> -v -o subdomains.txt

# Certificate transparency (passive, zero noise)
curl -s "https://crt.sh/?q=%.<target.com>&output=json" | jq -r '.[].name_value' | sort -u
```

## Phase 2: Sensitive File Discovery

```
site:<target.com> filetype:env
site:<target.com> filetype:log
site:<target.com> filetype:sql
site:<target.com> filetype:bak
site:<target.com> filetype:conf
site:<target.com> filetype:ini
site:<target.com> filetype:xml intext:password
site:<target.com> filetype:yaml intext:password
site:<target.com> filetype:json intext:api_key
site:<target.com> filetype:txt intext:password
```

## Phase 3: Credential & Secret Exposure

```
site:<target.com> intext:"DB_PASSWORD"
site:<target.com> intext:"api_key"
site:<target.com> intext:"SECRET_KEY"
site:<target.com> intext:"aws_access_key"
site:<target.com> intext:"-----BEGIN RSA PRIVATE KEY-----"
site:<target.com> intext:"password ="
```

GitHub & code repos:
```
site:github.com "<target.com>" api_key
site:github.com "<target.com>" password
site:github.com "<target.com>" secret
site:github.com "<target.com>" token
site:gitlab.com "<target.com>" password

# Paste sites
site:pastebin.com "<target.com>" password
site:paste.ee "<target.com>"
site:hastebin.com "<target.com>"
```

## Phase 4: Admin Panels & Login Pages

```
site:<target.com> inurl:admin
site:<target.com> inurl:login
site:<target.com> inurl:dashboard
site:<target.com> inurl:manage
site:<target.com> inurl:console
site:<target.com> intitle:"admin panel"
site:<target.com> intitle:"login"
site:<target.com> inurl:wp-admin
site:<target.com> inurl:phpmyadmin
site:<target.com> inurl:jenkins
site:<target.com> inurl:grafana
site:<target.com> inurl:kibana
site:<target.com> inurl:portainer
```

## Phase 5: Exposed Infrastructure

```
# Directory listings
site:<target.com> intitle:"index of"
site:<target.com> intitle:"index of" backup
site:<target.com> intitle:"index of" .git

# Git exposure
site:<target.com> inurl:"/.git/config"
site:<target.com> inurl:"/.git/"

# Error messages (leak stack traces, paths, versions)
site:<target.com> intext:"Warning: mysql_connect"
site:<target.com> intext:"ORA-01756"
site:<target.com> intext:"Fatal error"
site:<target.com> intitle:"500 Internal Server Error"
site:<target.com> intitle:"PHP Parse error"

# Exposed .env files
inurl:"/.env" site:<target.com>
inurl:"/.env.local" site:<target.com>
inurl:"/.env.backup" site:<target.com>
```

## Phase 6: Attack Surface — Injection Points

```
site:<target.com> inurl:".php?id="
site:<target.com> inurl:"?search="
site:<target.com> inurl:"?page="
site:<target.com> inurl:"?query="
site:<target.com> inurl:"?redirect="
site:<target.com> inurl:"?url="
site:<target.com> inurl:"?file="
site:<target.com> inurl:"?path="
site:<target.com> inurl:"?lang="
```

## Phase 7: Automated Dorking

```bash
# dorks-eye
python3 dorks_eye.py -t <target.com> -d dorks.txt -o results.txt

# Fast Google Dorks Scan
python3 fgds.py <target.com>

# googler (terminal)
pip install googler
googler --json "site:<target.com> filetype:env" > env_results.json
googler --json "site:<target.com> inurl:admin" > admin_results.json

# gf (grep-friendly patterns on Wayback Machine output)
echo "<target.com>" | waybackurls | gf sqli > sqli_candidates.txt
echo "<target.com>" | waybackurls | gf xss > xss_candidates.txt
echo "<target.com>" | waybackurls | gf ssrf > ssrf_candidates.txt
echo "<target.com>" | waybackurls | gf rce > rce_candidates.txt
```

## Phase 8: Certificate Transparency

```bash
# Subdomain discovery via CT logs (zero noise)
curl -s "https://crt.sh/?q=%.<target.com>&output=json" | \
  jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u | anew subdomains.txt

# Shodan (requires API key)
shodan search "hostname:<target.com>" --fields hostnames,ip_str,port --separator , > shodan_results.csv

# Censys
censys search "parsed.names: <target.com>" --fields ip,protocols,location.country
```

## Validation (REQUIRED before reporting)

For each finding:
1. Screenshot the search result and the exposed content
2. Verify the URL is accessible (HTTP 200)
3. Confirm it's not intentionally public content
4. Check if credentials/secrets are current (not rotated)
5. Document: search query used → URL found → content type → severity

Confidence threshold ≥0.70 required. Do NOT test/verify injection points found via dorking without explicit scope authorization.
