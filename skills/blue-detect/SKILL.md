---
name: blue-detect
description: "Blue team detection skill. WAF detection, IDS/IPS identification, log analysis, and malware detection. Use for defensive operations and incident detection. Triggers: 'blue detect', 'blue team', 'waf detect', 'ids', 'log analysis', 'malware detect'."
version: 1.0.0
phase: ["enumeration", "reporting"]
category: ["utility"]
tools: ["wafw00f", "nmap", "yara", "wireshark", "nuclei"]
tags: ["blue-team", "detection", "waf", "ids", "malware", "log-analysis"]
---

# Blue Team Detection

You are performing **defensive detection** operations. Your goal is to identify threats, detect attacks, and analyze logs.

## Tool Usage

```bash
# WAF detection
wafw00f https://target.com

# Network scanning for threats
nmap -sV -sC --script vuln <target> -oX threat-scan.xml

# Malware detection with YARA
yara -r malware-rules.yar /path/to/scan -o yara-results.txt

# Network traffic analysis
tshark -r capture.pcap -Y "http.request" -T fields -e http.host -e http.request.uri

# Vulnerability scanning
nuclei -l targets.txt -severity medium,high,critical -json -o nuclei-threat.json
```

## Detection Strategies

### WAF/IDS Detection
```bash
# WAF identification
wafw00f https://target.com -a

# IDS signature detection
nmap --script vuln <target>

# Firewall detection
nmap -sA <target>  # ACK scan for firewall rules
```

### Log Analysis
```bash
# Web server log analysis
grep -E "(SELECT|UNION|DROP|INSERT|UPDATE|DELETE)" access.log
grep -E "(<script>|javascript:|eval\()" access.log
grep -E "(\.\./|\.\.\\\\|%2e%2e)" access.log  # Path traversal

# Authentication failures
grep "Failed password" /var/log/auth.log | tail -20
grep "authentication failure" /var/log/auth.log

# Suspicious activity
grep -E "(wget|curl|nc|ncat|bash -i)" /var/log/auth.log
```

### Malware Detection
```bash
# YARA scan
yara -r /opt/yara-rules/malware/ /path/to/scan

# File hash check
sha256sum suspicious_file
# Check against VirusTotal or known malware hashes

# Process analysis
ps aux | grep -E "(wget|curl|nc|ncat|bash -i|/tmp/)"
netstat -tlnp | grep -E "(4444|5555|1337)"  # Common backdoor ports
```

## Output

Save to `.omop/blue-team/<engagement>/detect/`:
- `waf-detection.txt` — WAF identification results
- `threat-scan.xml` — Vulnerability scan results
- `yara-results.txt` — Malware detection results
- `log-analysis.txt` — Log analysis findings

## Next Phase

After detection, proceed to **blue-ir** for incident response if threats are found.
