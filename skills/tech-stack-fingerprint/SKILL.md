---
name: tech-stack-fingerprint
description: "Technology stack fingerprinting for security assessment. httpx-based technology detection with status codes and server banners, HTTP response header analysis (Server, X-Powered-By, Set-Cookie tech reveals), WhatWeb aggressive detection, Nuclei tech-detect templates, WordPress/Drupal/Joomla/framework identification, outdated component detection. Triggers: 'tech stack fingerprint', 'technology detection', 'whatweb scan', 'httpx fingerprint', 'cms detection', 'framework identification', 'server banner', 'technology enumeration', 'stack identification'."
---

# Tech — Stack Fingerprinting

httpx → headers → whatweb → nuclei tech-detect → high-risk platforms.

## Install

```bash
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
sudo apt-get install whatweb
nuclei -update-templates
```

---

## Phase 1: httpx Technology Detection

```bash
TARGET="https://TARGET"
OUTPUT_DIR="/workspace/output"
mkdir -p "$OUTPUT_DIR"

# Single target:
echo "$TARGET" | httpx -silent \
    -tech-detect \
    -title \
    -status-code \
    -content-length \
    -web-server \
    -response-time \
    -o "$OUTPUT_DIR/TARGET_tech_stack.txt"

# From subdomain list:
httpx -l subdomains.txt -silent \
    -tech-detect \
    -title \
    -status-code \
    -web-server \
    -json \
    -o "$OUTPUT_DIR/TARGET_tech_all.json"

# Parse JSON output:
cat "$OUTPUT_DIR/TARGET_tech_all.json" | python3 -c "
import json, sys
for line in sys.stdin:
    d = json.loads(line)
    techs = d.get('technologies', [])
    if techs:
        print(f\"{d['url']} — {', '.join(techs)}\")
"
```

---

## Phase 2: Header Analysis

```bash
TARGET="https://TARGET"

# Capture full headers:
curl -sk -I "$TARGET" | tee "$OUTPUT_DIR/TARGET_raw_headers.txt"

# Tech-revealing headers:
python3 << 'EOF'
import requests, sys, warnings
warnings.filterwarnings('ignore')

resp = requests.get(sys.argv[1], verify=False, timeout=10, allow_redirects=True)
headers = dict(resp.headers)

TECH_HEADERS = {
    'Server': 'Web server',
    'X-Powered-By': 'Backend language/framework',
    'X-Generator': 'CMS generator',
    'X-Drupal-Cache': 'Drupal CMS',
    'X-WordPress-Hit': 'WordPress',
    'X-Joomla-Cache': 'Joomla CMS',
    'X-AspNet-Version': 'ASP.NET version',
    'X-AspNetMvc-Version': 'ASP.NET MVC version',
    'Via': 'Proxy/CDN',
    'CF-Ray': 'Cloudflare CDN',
    'X-Cache': 'CDN/cache layer',
    'Set-Cookie': 'Session technology hint',
}

print("[Technology Headers Found]")
for h, desc in TECH_HEADERS.items():
    val = headers.get(h, headers.get(h.lower()))
    if val:
        print(f"  {h}: {val} ({desc})")

# Cookie-based tech hints:
cookies = resp.cookies
cookie_tech = {
    'PHPSESSID': 'PHP',
    'JSESSIONID': 'Java/Tomcat',
    'ASP.NET_SessionId': 'ASP.NET',
    'laravel_session': 'Laravel (PHP)',
    '__session': 'Express.js',
    '_rails_session': 'Ruby on Rails',
    'django_session': 'Django (Python)',
}
for name, tech in cookie_tech.items():
    if any(name.lower() in c.lower() for c in cookies):
        print(f"  Cookie hint: {name} → {tech}")
EOF
python3 /dev/stdin "$TARGET"
```

---

## Phase 3: WhatWeb Detection

```bash
TARGET="https://TARGET"

# Basic:
whatweb -v "$TARGET" | tee "$OUTPUT_DIR/TARGET_whatweb.txt"

# Aggressive (more requests):
whatweb -a 3 "$TARGET" | tee "$OUTPUT_DIR/TARGET_whatweb_aggressive.txt"

# From file list:
whatweb --input-file=subdomains.txt --log-verbose="$OUTPUT_DIR/TARGET_whatweb_all.txt"

# JSON output:
whatweb -a 3 --log-json="$OUTPUT_DIR/TARGET_whatweb.json" "$TARGET"
```

---

## Phase 4: Nuclei Tech Detection

```bash
TARGET="https://TARGET"

# Technology detection templates:
nuclei -u "$TARGET" \
    -t http/technologies/ \
    -silent \
    -o "$OUTPUT_DIR/TARGET_nuclei_tech.txt"

# Specific CMS templates:
nuclei -u "$TARGET" \
    -t http/technologies/wordpress/ \
    -t http/technologies/drupal/ \
    -t http/technologies/joomla/ \
    -t http/technologies/php/ \
    -silent

# All exposed tech fingerprints:
nuclei -u "$TARGET" \
    -t http/exposed-panels/ \
    -t http/exposed-tech/ \
    -silent \
    -o "$OUTPUT_DIR/TARGET_panels.txt"

# Wappalyzer-like detection:
nuclei -u "$TARGET" -t http/technologies/ -j | python3 -c "
import json, sys
for line in sys.stdin:
    try:
        d = json.loads(line)
        print(f\"[{d['info']['severity'].upper()}] {d['info']['name']}: {d.get('matched-at','')}\")
    except: pass
"
```

---

## Phase 5: High-Risk Platform Identification

```bash
TARGET="https://TARGET"

# Quick CMS check:
python3 << 'EOF'
import requests, warnings
warnings.filterwarnings('ignore')

target = input("Target URL: ").rstrip('/')

CMS_INDICATORS = {
    'WordPress': ['/wp-login.php', '/wp-admin/', '/wp-content/', '/wp-json/wp/v2/'],
    'Drupal': ['/user/login', '/?q=user/login', '/core/CHANGELOG.txt', '/sites/default/'],
    'Joomla': ['/administrator/', '/components/', '/templates/', '/media/system/'],
    'Magento': ['/admin/', '/js/mage/', '/skin/frontend/', '/app/etc/'],
    'Typo3': ['/typo3/', '/typo3conf/', '/typo3temp/'],
    'PrestaShop': ['/prestashop/', '/modules/', '/themes/'],
    'Jenkins': ['/jenkins/', '/j_acegi_security_check', '/api/json'],
    'Grafana': ['/grafana/', '/api/health', '/login'],
    'Kibana': ['/app/kibana', '/api/status'],
    'GitLab': ['/users/sign_in', '/-/health', '/api/v4/version'],
}

for cms, paths in CMS_INDICATORS.items():
    for path in paths:
        try:
            r = requests.get(target + path, verify=False, timeout=5, allow_redirects=False)
            if r.status_code not in (404, 410):
                print(f"[{cms}] {r.status_code} {target + path}")
        except: pass
EOF
```

---

## Phase 6: Outdated Component Detection

```bash
TARGET="https://TARGET"

# WordPress version-specific vulnerabilities:
curl -sk "$TARGET/feed/" | grep -i "generator" | head -3
curl -sk "$TARGET/readme.html" | grep -i "version" | head -3
curl -sk "$TARGET/wp-includes/version.php" | head -5  # if exposed

# Drupal version:
curl -sk "$TARGET/core/CHANGELOG.txt" | head -5
curl -sk "$TARGET/CHANGELOG.txt" | head -5

# JavaScript library versions:
curl -sk "$TARGET" | grep -oE "jquery[/-][0-9]+\.[0-9]+\.[0-9]+" | head -5
curl -sk "$TARGET" | grep -oE "angular[/-][0-9]+\.[0-9]+\.[0-9]+" | head -5
curl -sk "$TARGET" | grep -oE "react@[0-9]+\.[0-9]+\.[0-9]+" | head -5
curl -sk "$TARGET" | grep -oE "bootstrap/[0-9]+\.[0-9]+\.[0-9]+" | head -5

# Nuclei for version-specific CVEs:
nuclei -u "$TARGET" -t http/cves/ -severity critical,high -silent \
    -o "$OUTPUT_DIR/TARGET_cves.txt"
```

---

## Output

Save to `/workspace/output/`:
- `TARGET_tech_stack.txt` — httpx technology detection
- `TARGET_raw_headers.txt` — raw HTTP headers
- `TARGET_whatweb.txt` — WhatWeb results
- `TARGET_nuclei_tech.txt` — Nuclei tech templates
- `TARGET_panels.txt` — exposed admin panels

## Report Template

```
Target: TARGET
Date: DATE

## Technology Stack
- Web Server: Apache/Nginx/IIS VERSION
- Backend: PHP/Python/Java/Node.js VERSION  
- CMS/Framework: WordPress/Drupal/Laravel VERSION
- Database: MySQL/PostgreSQL/MongoDB (inferred)
- CDN/Cache: Cloudflare/Akamai/Varnish
- JavaScript: React/jQuery/Angular VERSION

## High-Risk Platforms
- [X] WordPress VERSION — CVE-XXXX-XXXX (critical)
- [X] Exposed admin panel — /wp-admin/

## Recommendations
1. Update all identified components to latest versions
2. Remove server version banners (X-Powered-By, Server headers)
3. Restrict access to admin interfaces by IP
```

## Next Phase

→ `recon-favicon` for favicon hash asset discovery
→ `tech-config-hardening` for security header audit
