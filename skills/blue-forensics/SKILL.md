---
name: blue-forensics
description: "Blue team forensics skill. Memory forensics, disk analysis, timeline reconstruction, and evidence preservation. Use for deep forensic analysis and evidence collection. Triggers: 'blue forensics', 'memory forensics', 'disk forensics', 'evidence', 'timeline reconstruction'."
version: 1.0.0
phase: ["reporting"]
category: ["utility"]
tools: ["volatility", "autopsy", "wireshark", "yara"]
tags: ["blue-team", "forensics", "memory", "disk", "evidence", "timeline"]
---

# Blue Team Forensics

You are performing **deep forensic analysis**. Your goal is to extract evidence, reconstruct timelines, and preserve chain of custody.

## Tool Usage

```bash
# Memory forensics with Volatility
vol -f memory.dmp windows.info
vol -f memory.dmp windows.pslist
vol -f memory.dmp windows.netscan
vol -f memory.dmp windows.filescan
vol -f memory.dmp windows.malfind
vol -f memory.dmp windows.dumpfiles --physoffset <offset>

# Disk forensics with Autopsy
autopsy <case_directory>

# Network forensics
tshark -r capture.pcap -z conv,tcp
tshark -r capture.pcap -Y "http.request" -T fields -e http.host -e http.request.uri

# File analysis
file suspicious_file
strings suspicious_file | grep -E "(http|ftp|cmd|shell|password)"
exiftool suspicious_file
```

## Forensic Workflow

### Evidence Collection
```bash
# Memory acquisition
# Use FTK Imager or similar tool to acquire memory dump
# Save to evidence/memory.dmp

# Disk acquisition
# Use dd or FTK Imager to acquire disk image
# dd if=/dev/sda of=evidence/disk.img bs=4M

# Network capture
tshark -i eth0 -w evidence/capture.pcap
```

### Memory Analysis
```bash
# 1. System information
vol -f memory.dmp windows.info

# 2. Process list
vol -f memory.dmp windows.pslist

# 3. Network connections
vol -f memory.dmp windows.netscan

# 4. File scan
vol -f memory.dmp windows.filescan | grep -i "suspicious\|malware\|payload"

# 5. Malware detection
vol -f memory.dmp windows.malfind

# 6. Dump suspicious files
vol -f memory.dmp windows.dumpfiles --physoffset <offset> --dump-dir evidence/
```

### Timeline Reconstruction
```bash
# File timeline
vol -f memory.dmp windows.filescan | sort -k2 > evidence/file-timeline.txt

# Process timeline
vol -f memory.dmp windows.pslist | sort -k3 > evidence/process-timeline.txt

# Network timeline
tshark -r capture.pcap -T fields -e frame.time -e ip.src -e ip.dst -e tcp.dstport > evidence/network-timeline.txt

# Event log analysis
vol -f memory.dmp windows.evtlogs > evidence/event-logs.txt
```

### Evidence Preservation
```bash
# Hash all evidence
sha256sum evidence/* > evidence/hashes.txt

# Create evidence manifest
ls -la evidence/ > evidence/manifest.txt

# Chain of custody documentation
echo "Evidence collected: $(date)" >> evidence/chain-of-custody.txt
```

## Output

Save to `.omop/blue-team/<engagement>/forensics/`:
- `memory-analysis.txt` — Memory forensics findings
- `disk-analysis.txt` — Disk forensics findings
- `timeline.txt` — Reconstructed timeline
- `evidence/` — Preserved evidence files
- `chain-of-custody.txt` — Chain of custody documentation

## Next Phase

After forensics, compile findings into the **IR report**.
