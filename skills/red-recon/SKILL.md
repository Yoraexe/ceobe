---
name: red-recon
description: "Red team reconnaissance skill. Stealth OSINT, passive enumeration, and social engineering preparation. Use for red team engagements requiring stealth. Triggers: 'red recon', 'red team recon', 'stealth recon', 'osint', 'passive recon'."
version: 1.0.0
phase: ["recon"]
category: ["recon"]
tools: ["subfinder", "amass", "httpx", "nmap", "responder"]
tags: ["red-team", "stealth", "osint", "passive", "recon"]
---

# Red Team Reconnaissance

You are performing **stealth reconnaissance** for a red team engagement. Your goal is to gather intelligence without detection.

## Stealth Principles

- **Passive first** — Use passive OSINT before active scanning
- **Slow and steady** — Rate-limit all active scans
- **Blend in** — Use legitimate user-agents and normal traffic patterns
- **Minimal footprint** — Avoid triggering IDS/IPS alerts

## Tool Usage

```bash
# Passive OSINT (no direct contact)
subfinder -d <target> -silent -all | anew subdomains.txt
amass enum -d <target> -passive | anew subdomains.txt

# Slow HTTP probing (rate-limited)
httpx -l subdomains.txt -silent -sc -td -rate-limit 10 -json -o httpx-results.json

# Stealth port scan (slow SYN scan)
nmap -sS -T2 -p 22,80,443,8080,8443 -iL subdomains.txt -oX nmap-stealth.xml

# Network listening (passive)
responder -I eth0 -w -v  # Capture NTLM hashes passively
```

## Red Team Recon Phases

| Phase | Tools | Stealth Level |
|-------|-------|:---:|
| **Passive OSINT** | subfinder, amass, theHarvester | 🟢 High |
| **DNS enum** | massdns, dig, nslookup | 🟢 High |
| **HTTP probe** | httpx (rate-limited) | 🟡 Medium |
| **Port scan** | nmap -sS -T2 | 🟡 Medium |
| **Active enum** | nuclei (slow) | 🔴 Low |

## Stealth Scanning

```bash
# Nmap stealth options
nmap -sS -T2 -f --mtu 24 -D RND:10 -iL targets.txt -oX stealth-scan.xml

# Slow nuclei scan
nuclei -l targets.txt -severity low,medium -rate-limit 5 -json -o nuclei-stealth.json

# Slow directory brute-force
ffuf -u https://target/FUZZ -w wordlist.txt -mc 200,301 -rate 5 -t 2 -json -o ffuf-stealth.json
```

## Output

Save to `.omop/red-team/<engagement>/recon/`:
- `osint.txt` — Passive OSINT findings
- `subdomains.txt` — Discovered subdomains
- `stealth-scan.xml` — Stealth port scan results
- `attack-surface.md` — Attack surface analysis

## Next Phase

After recon, proceed to **red-exploit** for stealth exploitation.
