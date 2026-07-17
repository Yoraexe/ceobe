---
name: recon-devtools
description: "Exposed developer tools and debug interfaces detection — Webpack DevServer, React DevTools, Vue DevTools, exposed metrics endpoints, debug ports, GraphiQL, Jupyter notebooks, Kibana. Triggers: 'devtools', 'debug interface', 'developer tools', 'webpack devserver', 'exposed debug', 'react devtools', 'sourcemap exposure', 'source map leak', 'kibana exposed'."
---

# Exposed Developer Tools Detection

Find accidentally exposed developer tools and debug interfaces in production.

---

## Phase 1: Debug Endpoints

```bash
TARGET="https://TARGET"

# Check for debug/dev ports and interfaces:
DEBUG_ENDPOINTS=(
  "/webpack-dev-server" "/__webpack_dev_server__"
  "/__react-devtools-hook__"
  "/socket.io/" "/sockjs-node/"
  "/graphiql" "/graphql-playground"
  "/playground"
  "/__admin__"
  "/__health" "/_health" "/health"
  "/debug" "/_debug" "/__debug__"
  "/.git/" "/.git/HEAD"
  "/jupyter" "/lab" "/tree"
  "/kibana" "/elastic"
  "/portainer"
  "/.vscode/"
  "/phpinfo.php" "/info.php" "/test.php"
  "/adminer.php" "/adminer/"
  "/phpmyadmin/" "/pma/"
  "/_profiler" "/_profiler/phpinfo"  # Symfony
  "/telescope" "/telescope/requests"  # Laravel
  "/horizon" "/horizon/dashboard"  # Laravel
  "/__clockwork" "/clockwork/"  # PHP Clockwork
)

for EP in "${DEBUG_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$EP")
  [ "$STATUS" != "404" ] && echo "FOUND ($STATUS): $TARGET$EP"
done | tee output/devtools_exposed.txt
```

---

## Phase 2: Source Map Exposure

```bash
TARGET="https://TARGET"

# Find source maps (expose original source code):
JS_URLS=$(curl -s "$TARGET/" | grep -oE '"[^"]+\.js"' | tr -d '"')
for JS in $JS_URLS; do
  MAP_URL="${TARGET}${JS}.map"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$MAP_URL")
  if [ "$STATUS" == "200" ]; then
    echo "SOURCE MAP EXPOSED: $MAP_URL"
    curl -s "$MAP_URL" | jq '.sources[]' 2>/dev/null | head -20
    curl -s "$MAP_URL" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(d['sourcesContent'][i][:200]) for i in range(min(3,len(d.get('sourcesContent',[]))))]"
  fi
done | tee output/sourcemaps.txt
```

---

## Phase 3: Exposed Dev Ports

```bash
TARGET_IP="TARGET_IP"

# Scan for common dev ports:
nmap -sT -p 3000,4000,4200,5000,5173,8000,8080,8888,9000,9090,9229 \
  --open "$TARGET_IP" 2>/dev/null | tee output/dev_ports.txt

# Check common dev servers:
for PORT in 3000 4000 4200 5000 5173 8000 8080 8888 9000 9090; do
  RESP=$(curl -s -I "http://$TARGET_IP:$PORT" --connect-timeout 2 2>/dev/null | head -5)
  [ -n "$RESP" ] && echo "PORT $PORT: $RESP"
done | tee output/dev_services.txt

# Node.js debug port (Chrome DevTools):
nmap -p 9229 "$TARGET_IP" 2>/dev/null | grep "open"
curl -s "http://$TARGET_IP:9229/json" 2>/dev/null | jq .
```

---

## Phase 4: Jupyter & Data Science Tools

```bash
TARGET="https://TARGET"

# Jupyter notebook exposure (often no auth):
for PORT in 8888 8889 8890; do
  RESP=$(curl -s "http://${TARGET##https://}:$PORT/api/contents" --connect-timeout 3 2>/dev/null)
  echo "$RESP" | grep -q "content" && echo "JUPYTER EXPOSED on port $PORT"
done

# Kibana:
curl -s "${TARGET}:5601/api/status" 2>/dev/null | jq '.version, .status.overall.state'

# Grafana default creds:
curl -s "${TARGET}:3000/api/health" 2>/dev/null | jq .
curl -s -u "admin:admin" "${TARGET}:3000/api/org" 2>/dev/null | jq .name
```

---

## Output

Save to `output/`:
- `devtools_exposed.txt` — exposed debug interfaces
- `sourcemaps.txt` — exposed source maps with content
- `dev_services.txt` — open dev server ports

## Next Phase

→ `vuln-info-disclosure` for further information disclosure testing
→ `pentest-report` to document dev tool exposure
