---
name: blue-ir
description: "Blue team incident response skill. Incident triage, timeline analysis, containment, and eradication. Use for incident response operations and breach investigation. Triggers: 'blue ir', 'incident response', 'breach', 'containment', 'eradication', 'timeline'."
version: 1.0.0
phase: ["reporting"]
category: ["utility"]
tools: ["volatility", "wireshark", "yara", "autopsy"]
tags: ["blue-team", "incident-response", "ir", "breach", "containment", "timeline"]
---

# Blue Team Incident Response

You are performing **incident response** operations. Your goal is to investigate breaches, contain threats, and eradicate malware.

## IR Workflow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  TRIAGE  │────▶│  ANALYZE │────▶│ CONTAIN  │────▶│ ERADICATE│
│  Initial │     │  Timeline│     │  Isolate │     │  Remove  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                        │
                                                        ▼
                                                  ┌──────────┐
                                                  │  RECOVER │
                                                  │  Restore │
                                                  └──────────┘
```

## Tool Usage

```bash
# Memory forensics
vol -f memory.dmp windows.pslist
vol -f memory.dmp windows.netscan
vol -f memory.dmp windows.malfind
vol -f memory.dmp windows.dumpfiles --pid <pid>

# Network forensics
tshark -r capture.pcap -Y "http.request" -T fields -e http.host -e http.request.uri
tshark -r capture.pcap -z conv,tcp

# Malware analysis
yara -r malware-rules.yar suspicious_file
file suspicious_file
strings suspicious_file | grep -E "(http|ftp|cmd|shell)"

# Disk forensics
autopsy <case_directory>
```

## IR Phases

### Triage
```bash
# Initial assessment
vol -f memory.dmp windows.info
vol -f memory.dmp windows.pslist | grep -E "(cmd|powershell|nc|ncat)"

# Network connections
vol -f memory.dmp windows.netscan | grep ESTABLISHED
tshark -r capture.pcap -z conv,tcp
```

### Timeline Analysis
```bash
# File timeline
vol -f memory.dmp windows.filescan | sort -k2

# Process timeline
vol -f memory.dmp windows.pslist | sort -k3

# Network timeline
tshark -r capture.pcap -T fields -e frame.time -e ip.src -e ip.dst -e tcp.dstport
```

### Containment
```bash
# Isolate host
# Network isolation (firewall rules)
iptables -A INPUT -s <infected-ip> -j DROP
iptables -A OUTPUT -d <infected-ip> -j DROP

# Kill malicious processes
taskkill /PID <pid> /F
```

### Eradication
```bash
# Remove malware
yara -r malware-rules.yar /path/to/scan
# Delete identified malware files

# Clean persistence
schtasks /delete /tn "MaliciousTask" /f
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MaliciousEntry" /f
```

## Output

Save to `.omop/blue-team/<engagement>/ir/`:
- `timeline.txt` — Incident timeline
- `indicators.txt` — Indicators of compromise (IOCs)
- `containment-log.txt` — Containment actions taken
- `eradication-log.txt` — Eradication actions taken

## Next Phase

After IR, proceed to **blue-forensics** for deep forensic analysis.
