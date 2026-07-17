---
name: blue-report
description: "Blue team reporting skill. Incident response reports, IOC documentation, and executive summaries. Use for blue team reporting and documentation. Triggers: 'blue report', 'ir report', 'ioc', 'executive summary', 'incident report'."
version: 1.0.0
phase: ["reporting"]
category: ["utility"]
tools: ["volatility", "wireshark", "yara"]
tags: ["blue-team", "report", "ir", "ioc", "executive-summary"]
---

# Blue Team Reporting

You are compiling the **incident response report** from all findings discovered during detection, IR, and forensics phases.

## Report Structure

```markdown
# Incident Response Report

## Executive Summary
[1-2 paragraph overview of incident, impact, and response]

## Incident Overview
- **Incident ID:** IR-YYYY-NNN
- **Date Detected:** [date]
- **Date Resolved:** [date]
- **Severity:** Critical/High/Medium/Low
- **Status:** Contained/Eradicated/Recovered

## Timeline
| Time | Event | Action Taken |
|------|-------|--------------|
| YYYY-MM-DD HH:MM | Initial detection | Triage initiated |
| ... | ... | ... |

## Indicators of Compromise (IOCs)

### Network IOCs
| IP Address | Port | Protocol | Description |
|------------|------|----------|-------------|
| x.x.x.x | 443 | HTTPS | C2 server |

### File IOCs
| Hash | Type | Description |
|------|------|-------------|
| sha256:... | Malware | Backdoor |

### Host IOCs
| Hostname | IP | Role | Compromise Level |
|----------|----|------|------------------|
| server01 | x.x.x.x | Web server | Fully compromised |

## Attack Chain
1. Initial access via [vector]
2. Privilege escalation via [method]
3. Lateral movement via [protocol]
4. Data exfiltration via [channel]

## Containment Actions
- Network isolation of affected hosts
- Malicious process termination
- Credential reset

## Eradication Actions
- Malware removal
- Persistence mechanism removal
- Vulnerability patching

## Recommendations
1. Implement [control]
2. Patch [vulnerability]
3. Monitor [indicator]

## Appendices
- Raw logs
- Memory analysis output
- Network capture analysis
- Evidence chain of custody
```

## IOC Documentation

```bash
# Network IOCs
grep -E "(ESTABLISHED|SYN_SENT)" evidence/network-timeline.txt | sort -u > iocs/network-iocs.txt

# File IOCs
sha256sum evidence/malware/* > iocs/file-hashes.txt

# Host IOCs
vol -f memory.dmp windows.netscan | grep ESTABLISHED | sort -u > iocs/host-iocs.txt
```

## Output

Save to `.omop/blue-team/<engagement>/report/`:
- `ir-report.md` — Full incident response report
- `executive-summary.md` — Executive summary
- `iocs/` — Indicators of compromise
- `evidence/` — Preserved evidence

## Next Phase

Submit report to stakeholders and close the incident.
