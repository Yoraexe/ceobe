---
name: tool-nmap
description: "Nmap comprehensive usage — SYN scan, service detection, script scanning, OS fingerprinting, aggressive scan, CVE detection, UDP scan, output formats. Triggers: 'nmap', 'port scan', 'nmap scan', 'service detection', 'nmap script', 'nse script', 'port scanning', 'network scan', 'nmap aggressive', 'nmap udp'."
---

# Nmap Comprehensive Usage

Full-coverage port scanning and service detection with NSE scripts.

---

## Phase 1: Discovery Scans

```bash
TARGET="TARGET_IP or CIDR"

# Fast host discovery (no port scan):
nmap -sn "$TARGET" -oG output/ping_sweep.txt 2>/dev/null
grep "Up" output/ping_sweep.txt | awk '{print $2}' > output/live_hosts.txt

# Quick top-100 ports:
nmap -F "$TARGET" --open -oG output/fast_scan.txt 2>/dev/null

# Top 1000 ports (default):
nmap -sV "$TARGET" --open -oA output/nmap_top1000 2>/dev/null
```

---

## Phase 2: Service Enumeration

```bash
TARGET="TARGET_IP"

# Service version detection:
nmap -sV -sC --open "$TARGET" -oA output/nmap_svc 2>/dev/null

# Full port scan:
nmap -p- -sV --open "$TARGET" --min-rate 3000 -oA output/nmap_full 2>/dev/null

# Aggressive scan (OS + versions + scripts + traceroute):
nmap -A "$TARGET" --open -oA output/nmap_aggressive 2>/dev/null

# UDP scan (common UDP services):
nmap -sU -p 53,67,68,69,123,161,162,500,514,520,631 "$TARGET" --open -oA output/nmap_udp 2>/dev/null
```

---

## Phase 3: NSE Script Categories

```bash
TARGET="TARGET_IP"

# All default + safe scripts:
nmap -sC "$TARGET" 2>/dev/null

# Vulnerability scripts:
nmap --script vuln "$TARGET" 2>/dev/null | tee output/nmap_vuln.txt

# Service-specific:
nmap --script "smb-*" -p 139,445 "$TARGET" 2>/dev/null
nmap --script "http-*" -p 80,443,8080 "$TARGET" 2>/dev/null
nmap --script "ssh-*" -p 22 "$TARGET" 2>/dev/null
nmap --script "ftp-*" -p 21 "$TARGET" 2>/dev/null
nmap --script "dns-*" -p 53 "$TARGET" 2>/dev/null

# Brute force scripts (careful with lockout):
nmap --script ssh-brute -p 22 "$TARGET" 2>/dev/null
nmap --script ftp-brute -p 21 "$TARGET" 2>/dev/null
nmap --script http-brute "$TARGET" 2>/dev/null
```

---

## Phase 4: Output & Analysis

```bash
TARGET="TARGET_IP"

# Parse grepable output:
grep "open" output/nmap_full.gnmap | awk '{print $2" "$5}' | tr ',' '\n' | grep "/open/" | \
  awk -F/ '{print $1}' | sort -n | tee output/open_ports.txt

# Convert XML to HTML:
xsltproc output/nmap_full.xml -o output/nmap_full.html 2>/dev/null

# Quick summary:
nmap -oX output/nmap_full.xml "$TARGET" -sV --open 2>/dev/null
python3 -c "
import xml.etree.ElementTree as ET
tree = ET.parse('output/nmap_full.xml')
for host in tree.findall('.//host'):
    ip = host.find('.//address[@addrtype=\"ipv4\"]').get('addr')
    for port in host.findall('.//port[@protocol=\"tcp\"]'):
        if port.find('state').get('state') == 'open':
            portid = port.get('portid')
            svc = port.find('service').get('name', '?')
            print(f'{ip}:{portid} ({svc})')
"
```

---

## Output

Save to `output/`:
- `nmap_svc.*` — service version scan
- `nmap_full.*` — all ports scan
- `nmap_vuln.txt` — vulnerability script output

## Next Phase

→ Target specific services found: `proto-smb`, `proto-ssh`, `proto-rdp`
→ `pentest-exploit` for exploitation based on discovered services
