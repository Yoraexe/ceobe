---
name: ctf-forensics
description: "CTF forensics skill. Memory forensics, disk analysis, steganography, and file recovery. Use for forensic challenges and incident response. Triggers: 'ctf forensics', 'forensics', 'memory', 'stego', 'disk', 'pcap', 'volatility'."
version: 1.0.0
phase: ["reporting"]
category: ["utility"]
tools: ["volatility", "wireshark", "autopsy", "yara"]
tags: ["ctf", "forensics", "memory", "disk", "stego", "pcap"]
---

# CTF Forensics

You are performing **CTF forensic analysis**. Your goal is to extract flags from memory dumps, disk images, and network captures.

## Tool Usage

```bash
# Memory forensics with volatility
vol -f memory.dmp windows.pslist
vol -f memory.dmp windows.netscan
vol -f memory.dmp windows.filescan
vol -f memory.dmp windows.dumpfiles --pid <pid>

# Network analysis with wireshark/tshark
tshark -r capture.pcap -Y "http.request" -T fields -e http.host -e http.request.uri
tshark -r capture.pcap -Y "dns" -T fields -e dns.qry.name

# File analysis
file <file>
strings <file> | grep -i "flag\|ctf"
exiftool <file>

# Steganography
steghide extract -sf image.jpg -p password
binwalk -e firmware.bin
```

## Forensic Analysis Types

| Type | Tools | Approach |
|------|-------|----------|
| **Memory** | volatility | Process list, network, file recovery |
| **Disk** | autopsy, sleuthkit | File recovery, timeline |
| **Network** | wireshark, tshark | Protocol analysis, traffic |
| **Stego** | steghide, binwalk | Hidden data extraction |
| **File** | file, strings, exiftool | File type, metadata |

## Memory Forensics Workflow

```bash
# 1. Identify OS profile
vol -f memory.dmp windows.info

# 2. List processes
vol -f memory.dmp windows.pslist

# 3. Network connections
vol -f memory.dmp windows.netscan

# 4. File recovery
vol -f memory.dmp windows.filescan | grep -i "flag\|secret\|password"
vol -f memory.dmp windows.dumpfiles --physoffset <offset>

# 5. Malware detection
vol -f memory.dmp windows.malfind
vol -f memory.dmp windows.vadinfo
```

## Network Forensics

```bash
# HTTP traffic
tshark -r capture.pcap -Y "http" -T fields -e http.host -e http.request.uri -e http.response.code

# DNS queries
tshark -r capture.pcap -Y "dns" -T fields -e dns.qry.name -e dns.a

# Extract files from pcap
tshark -r capture.pcap --export-objects http,<output_dir>

# Follow TCP stream
tshark -r capture.pcap -z follow,tcp,ascii,<stream_id>
```

## Output

Save to `.omop/ctf/<challenge-name>/forensics/`:
- `analysis.txt` — Analysis findings
- `flag.txt` — Extracted flags
- `recovered/` — Recovered files
- `timeline.txt` — Forensic timeline

## Next Phase

After forensics, compile findings into the final CTF report.
