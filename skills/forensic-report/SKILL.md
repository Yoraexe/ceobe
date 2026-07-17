---
name: forensic-report
description: "Forensic report generation skill. Compiles memory, disk, and network findings into a chain-of-custody IR report. Includes IOC list, timeline, evidence inventory, and remediation roadmap. Triggers: 'forensic report', 'ir report', 'incident report', 'chain of custody', 'ioc', 'forensics findings'."
---

# Forensic Report Generation

You are generating a **forensic investigation report** from findings collected across memory, disk, and network analysis phases. The report must be suitable for legal proceedings, insurance claims, and executive review.

## Required Inputs

Before generating, collect:
- Memory forensics output (`forensic-memory` findings)
- Disk forensics output (`forensic-disk` findings)
- Network forensics output (`forensic-network` findings)
- Case metadata (incident date, analyst name, case number, evidence hashes)

## Report Structure

### 1. Executive Summary (1-2 pages)

```markdown
## Executive Summary

**Case Number:** CASE-2026-001
**Incident Date:** 2026-06-15
**Analysis Date:** 2026-06-20
**Analyst:** [Name]
**Classification:** CONFIDENTIAL

### Incident Overview
Brief description of what happened in non-technical terms.

### Key Findings
- [Finding 1] — e.g., Ransomware deployed via phishing email at 14:32 UTC
- [Finding 2] — e.g., 3.2 GB exfiltrated to 185.x.x.x over 4-hour window
- [Finding 3] — e.g., Persistence via scheduled task "WindowsUpdate"

### Business Impact
- Systems affected: 12 endpoints, 2 servers
- Data at risk: Customer PII in /srv/data/ (encrypted by ransomware)
- Estimated downtime: 48 hours

### Recommended Actions
1. Isolate affected systems (immediate)
2. Reset all domain credentials (within 24 hours)
3. Patch CVE-2024-XXXX on all Windows endpoints (within 7 days)
```

### 2. Timeline of Events

```markdown
## Timeline

| Timestamp (UTC) | Event | Evidence Source | Confidence |
|:--- |:--- |:--- |:--- |
| 2026-06-15 09:14 | Phishing email received by user@corp.com | Email logs | High |
| 2026-06-15 09:17 | User opened malicious attachment order.docx | Prefetch, EventLog | High |
| 2026-06-15 09:18 | PowerShell executed encoded command | EventLog ID 4104 | High |
| 2026-06-15 09:19 | C2 connection established to 185.x.x.x:443 | PCAP, netstat | High |
| 2026-06-15 11:42 | Lateral movement via Pass-the-Hash to SERVER01 | Security EventLog | Medium |
| 2026-06-15 14:32 | Ransomware payload dropped and executed | MFT, malfind | High |
| 2026-06-15 14:33 | Data exfiltration begins (HTTP POST to 185.x.x.x) | PCAP | High |
| 2026-06-15 18:47 | Ransom note created | MFT | High |
```

### 3. Evidence Inventory

```markdown
## Evidence Inventory

All evidence hashed before analysis. Chain of custody maintained.

| Item | Description | Hash (SHA256) | Acquired | Analyzed |
|:--- |:--- |:--- |:--- |:--- |
| memory.dmp | RAM dump from WORKSTATION01 | abc123... | 2026-06-16 | 2026-06-17 |
| disk.img | Disk image from WORKSTATION01 | def456... | 2026-06-16 | 2026-06-17 |
| capture.pcap | Network capture (perimeter) | ghi789... | 2026-06-16 | 2026-06-18 |
```

### 4. Technical Findings

```markdown
## Technical Findings

### Malware Analysis

**SHA256:** `abc123...`
**File:** `update.exe` (recovered via foremost from disk.img)
**Type:** Ransomware dropper
**Behavior:**
- Drops payload to `%TEMP%\svchost32.exe`
- Establishes persistence via `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- Encrypts files with AES-256, appends `.locked` extension
- C2: 185.x.x.x:443 (TLS, Cobalt Strike beacon pattern)

### Persistence Mechanisms

| Mechanism | Location | Value | Status |
|:--- |:--- |:--- |:--- |
| Registry Run | HKCU\...\Run\WindowsUpdate | C:\Temp\svchost32.exe | Removed |
| Scheduled Task | \Microsoft\Windows\WindowsUpdate | Every 15 min | Removed |
| WMI Subscription | WMI event filter | svchost32.exe on logon | Removed |

### Credentials Exposed

| Account | Source | Evidence | Action Required |
|:--- |:--- |:--- |:--- |
| administrator@corp.com | LSASS memory dump | malfind, hashdump | Reset immediately |
| svc-backup@corp.com | NTLM hash in PCAP | NTLM handshake | Reset immediately |
```

### 5. IOC List

```markdown
## Indicators of Compromise

### File IOCs
| File | Hash | Location |
|:--- |:--- |:--- |
| update.exe | abc123... | %TEMP% |
| svchost32.exe | def456... | C:\Windows\Temp |
| order.docx | ghi789... | %USERPROFILE%\Downloads |

### Network IOCs
| Type | Value | Description |
|:--- |:--- |:--- |
| IP | 185.x.x.x | C2 server |
| Domain | evil.example.com | C2 domain |
| URL | https://evil.example.com/check | Beacon URL |
| UserAgent | Mozilla/5.0 (custom) | CS beacon UA |

### Registry IOCs
| Key | Value | Data |
|:--- |:--- |:--- |
| HKCU\...\Run | WindowsUpdate | C:\Temp\svchost32.exe |

### Behavioral IOCs
- PowerShell with base64 encoded command
- LSASS memory access from non-system process
- Encrypted traffic to non-standard ports
```

### 6. Remediation Roadmap

```markdown
## Remediation

### Immediate (0-24 hours)
- [ ] Isolate all affected systems from network
- [ ] Reset Domain Admin and service account credentials
- [ ] Block IOC IPs/domains at perimeter firewall
- [ ] Preserve all evidence (do not wipe systems yet)

### Short-term (24-72 hours)
- [ ] Rebuild affected endpoints from clean images
- [ ] Restore from last clean backup (verify integrity first)
- [ ] Deploy EDR on all endpoints
- [ ] Enable PowerShell script block logging (EventID 4104)

### Long-term (1-4 weeks)
- [ ] Patch CVE-2024-XXXX across all Windows systems
- [ ] Implement MFA for all remote access
- [ ] Enable LAPS for local administrator accounts
- [ ] Conduct phishing awareness training
- [ ] Deploy network segmentation to limit lateral movement
```

## Output

Save report to: `.omop/engagement/report/forensic-report-CASE-<number>.md`

Also generate:
- IOC list in machine-readable format: `iocs.json`
- STIX 2.1 bundle if threat intel sharing required: `stix-bundle.json`
