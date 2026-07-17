---
name: ctf-crypto
description: "CTF cryptography skill. Hash cracking, encoding/decoding, RSA/AES challenges, and crypto analysis. Use for crypto challenges and hash identification. Triggers: 'ctf crypto', 'crypto', 'hash', 'rsa', 'aes', 'base64', 'decode'."
version: 1.0.0
phase: ["exploitation"]
category: ["exploitation"]
tools: ["hashcat", "john", "pwntools"]
tags: ["ctf", "crypto", "hash", "encoding", "rsa", "aes"]
---

# CTF Cryptography

You are performing **CTF crypto challenges**. Your goal is to identify, analyze, and break cryptographic implementations.

## Tool Usage

```bash
# Hash identification
python3 -c "
import hashlib
print('Available:', hashlib.algorithms_available)
"

# Hash cracking with hashcat
hashcat -m 0 hashes.txt wordlist.txt          # MD5
hashcat -m 100 hashes.txt wordlist.txt        # SHA1
hashcat -m 1000 hashes.txt wordlist.txt       # NTLM
hashcat -m 1800 hashes.txt wordlist.txt       # sha512crypt

# John the Ripper
john --wordlist=wordlist.txt hashes.txt
john --format=raw-md5 hashes.txt

# Python crypto
python3 -c "
import base64, hashlib
# Base64
print(base64.b64decode('...'))
# MD5
print(hashlib.md5(b'test').hexdigest())
"
```

## Common Crypto Challenges

| Type | Tools | Approach |
|------|-------|----------|
| **Hash cracking** | hashcat, john | Wordlist + rules |
| **Base64/encoding** | python3 | Decode, identify |
| **RSA** | python3, rsatool | Factor, CRT, common modulus |
| **AES** | python3, pycryptodome | Known plaintext, ECB/CBC |
| **XOR** | python3 | Known plaintext, frequency |
| **Custom** | python3 | Reverse engineer algorithm |

## Crypto Analysis

```python
# Frequency analysis
from collections import Counter
text = "..."
freq = Counter(text)
print(freq.most_common())

# XOR with known plaintext
known = b"FLAG{"
cipher = bytes.fromhex("...")
key = bytes([c ^ k for c, k in zip(cipher, known)])

# RSA common modulus attack
# Given: n, e1, e2, c1, c2 where gcd(e1, e2) = 1
# Use extended Euclidean algorithm
```

## Output

Save to `.omop/ctf/<challenge-name>/crypto/`:
- `analysis.py` — Analysis scripts
- `flag.txt` — Decrypted flags
- `hashes.txt` — Identified hashes

## Next Phase

After crypto, proceed to **ctf-forensics** if needed.
