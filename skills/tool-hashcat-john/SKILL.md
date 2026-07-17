---
name: tool-hashcat-john
description: "Password cracking with Hashcat and John the Ripper — hash identification, wordlist attacks, rule-based attacks, hybrid attacks, rainbow tables, mask attacks. Triggers: 'hashcat', 'john the ripper', 'password cracking', 'hash cracking', 'hashcat crack', 'john crack', 'wordlist attack', 'password hash', 'crack hash'."
---

# Password Cracking — Hashcat & John the Ripper

Identify and crack password hashes with wordlist, rule, and mask attacks.

---

## Phase 1: Hash Identification

```bash
HASH="$1"

# Identify hash type:
hash-identifier "$HASH" 2>/dev/null
# Or:
hashid "$HASH" 2>/dev/null
# Or check manually:
# MD5:     32 hex chars
# SHA1:    40 hex chars
# SHA256:  64 hex chars
# SHA512:  128 hex chars
# bcrypt:  $2y$, $2a$
# NTLM:    32 hex (but different from MD5)
# NTLMv2:  DOMAIN\USER::DOMAIN:CHALLENGE:HASH:BLOB
```

---

## Phase 2: Hashcat Attacks

```bash
HASH_FILE="hashes.txt"
WORDLIST="/usr/share/wordlists/rockyou.txt"

# Straight wordlist (mode 0):
hashcat -m 0 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null        # MD5
hashcat -m 100 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null      # SHA1
hashcat -m 1800 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null     # SHA512crypt
hashcat -m 3200 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null     # bcrypt
hashcat -m 1000 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null     # NTLM
hashcat -m 5600 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null     # NTLMv2
hashcat -m 13100 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null    # Kerberos TGS (Kerberoast)
hashcat -m 18200 "$HASH_FILE" "$WORDLIST" --force 2>/dev/null    # Kerberos AS-REP

# With rules (much more effective):
hashcat -m 1000 "$HASH_FILE" "$WORDLIST" -r /usr/share/hashcat/rules/best64.rule --force 2>/dev/null
hashcat -m 1000 "$HASH_FILE" "$WORDLIST" -r /usr/share/hashcat/rules/rockyou-30000.rule --force 2>/dev/null

# Mask attack (brute force with pattern):
hashcat -m 1000 "$HASH_FILE" -a 3 '?u?l?l?l?d?d?d?d' --force 2>/dev/null  # Passwd1234
hashcat -m 1000 "$HASH_FILE" -a 3 '?a?a?a?a?a?a?a?a' --force 2>/dev/null  # 8-char all

# Hybrid (wordlist + mask):
hashcat -m 1000 "$HASH_FILE" -a 6 "$WORDLIST" '?d?d?d?d' --force 2>/dev/null  # word + 4 digits
```

---

## Phase 3: John the Ripper

```bash
HASH_FILE="hashes.txt"
WORDLIST="/usr/share/wordlists/rockyou.txt"

# Basic wordlist:
john "$HASH_FILE" --wordlist="$WORDLIST" 2>/dev/null
# Rules:
john "$HASH_FILE" --wordlist="$WORDLIST" --rules 2>/dev/null

# Show cracked:
john --show "$HASH_FILE" 2>/dev/null

# Format-specific:
john --format=nt "$HASH_FILE" --wordlist="$WORDLIST" 2>/dev/null
john --format=bcrypt "$HASH_FILE" --wordlist="$WORDLIST" 2>/dev/null

# ZIP/RAR/SSH key:
zip2john protected.zip > zip_hash.txt
rar2john protected.rar > rar_hash.txt
ssh2john id_rsa > ssh_hash.txt
john zip_hash.txt --wordlist="$WORDLIST" 2>/dev/null
```

---

## Output

Save to `output/`:
- `cracked.txt` — cracked plaintext passwords
- Run `hashcat -m HASH_MODE hashes.txt --show` to display results

## Next Phase

→ Use cracked creds in `pentest-exploit` or `post-lateral-movement`
→ `tool-impacket` for pass-the-hash if NTLM hashes
