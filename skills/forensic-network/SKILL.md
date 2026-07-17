---
name: forensic-network
description: "Network forensics skill. PCAP analysis, traffic reconstruction, C2 detection, credential extraction, and protocol analysis using tshark, tcpdump, and wireshark. Triggers: 'network forensics', 'pcap analysis', 'traffic analysis', 'c2 detection', 'packet capture', 'tshark', 'wireshark forensics'."
---

# Network Forensics

You are performing **network forensics** on captured traffic. Goal: reconstruct what happened on the wire — exfiltration, C2 activity, lateral movement, credential capture.

## Tool Priority Order

1. **tshark** — CLI packet analysis and field extraction
2. **tcpdump** — raw capture and quick filter
3. **wireshark** — GUI for complex protocol analysis

## Tool Availability Check

```bash
which tshark tcpdump
tshark --version
```

## Workflow

### Phase 1: PCAP Overview

```bash
# Basic stats — what's in this capture?
tshark -r capture.pcap -z io,phs -q              # protocol hierarchy
tshark -r capture.pcap -z conv,tcp -q            # TCP conversations
tshark -r capture.pcap -z endpoints,ip -q        # unique IPs
capinfos capture.pcap                             # capture metadata
```

### Phase 2: Credential Extraction

```bash
# HTTP Basic Auth
tshark -r capture.pcap -Y "http.authorization" \
  -T fields -e ip.src -e http.authorization -E header=y

# FTP credentials
tshark -r capture.pcap -Y "ftp.request.command == USER or ftp.request.command == PASS" \
  -T fields -e ip.src -e ftp.request.arg

# SMTP authentication
tshark -r capture.pcap -Y "smtp.auth.username or smtp.auth.password" \
  -T fields -e ip.src -e smtp.auth.username -e smtp.auth.password

# Kerberos tickets
tshark -r capture.pcap -Y "kerberos" \
  -T fields -e ip.src -e kerberos.CNameString -e kerberos.realm

# NTLM hashes (for offline cracking)
tshark -r capture.pcap -Y "ntlmssp.auth.username" \
  -T fields -e ip.src -e ntlmssp.auth.username -e ntlmssp.auth.domain
```

### Phase 3: Suspicious Traffic Detection

```bash
# DNS tunneling (large DNS queries/responses)
tshark -r capture.pcap -Y "dns" \
  -T fields -e frame.time -e ip.src -e dns.qry.name -e dns.resp.len \
  | awk '$4 > 200' > suspicious-dns.txt

# Beaconing / regular intervals (potential C2)
tshark -r capture.pcap -Y "http or https or tcp" \
  -T fields -e frame.time -e ip.dst -e tcp.dstport \
  | sort | uniq -c | sort -rn | head -50 > beacon-candidates.txt

# Large data transfers (exfiltration)
tshark -r capture.pcap -z conv,tcp -q | awk '$5 > 1000000' > large-transfers.txt

# Non-standard ports for common protocols
tshark -r capture.pcap -Y "http and tcp.port != 80 and tcp.port != 8080 and tcp.port != 443" \
  -T fields -e ip.src -e ip.dst -e tcp.dstport -e http.host > non-standard-http.txt
```

### Phase 4: HTTP Traffic Reconstruction

```bash
# Extract all HTTP hosts and URIs
tshark -r capture.pcap -Y "http.request" \
  -T fields -e frame.time -e ip.src -e http.host -e http.request.uri \
  -E header=y -E separator=, > http-requests.csv

# Extract POST data (potential credentials/exfil)
tshark -r capture.pcap -Y "http.request.method == POST" \
  -T fields -e ip.src -e http.host -e http.request.uri -e http.file_data > post-data.txt

# Follow HTTP streams and export objects
tshark -r capture.pcap --export-objects http,./http-objects/
```

### Phase 5: File Extraction

```bash
# Extract files from HTTP, SMB, FTP, TFTP
tshark -r capture.pcap --export-objects http,./extracted/http/
tshark -r capture.pcap --export-objects smb,./extracted/smb/
tshark -r capture.pcap --export-objects ftp-data,./extracted/ftp/
tshark -r capture.pcap --export-objects tftp,./extracted/tftp/

# Run exiftool on extracted files for metadata
exiftool -json ./extracted/ > extracted-metadata.json
```

### Phase 6: C2 Framework Detection

```bash
# Cobalt Strike beacon signatures
tshark -r capture.pcap -Y "http contains 'Accept: */*' and http contains 'User-Agent:'" \
  -T fields -e ip.src -e ip.dst -e http.user_agent > cs-candidates.txt

# Metasploit Meterpreter (TLS on non-443)
tshark -r capture.pcap -Y "ssl.record.content_type == 23 and tcp.port != 443 and tcp.port != 8443" \
  -T fields -e ip.src -e ip.dst -e tcp.dstport > meterpreter-candidates.txt

# DNS beaconing
tshark -r capture.pcap -Y "dns.qry.type == 16 or dns.qry.type == 28" \
  -T fields -e ip.src -e dns.qry.name | sort | uniq -c | sort -rn > dns-txt-aaaa.txt
```

## Output Structure

```
engagement/forensics/network/
├── http-requests.csv           # All HTTP requests
├── post-data.txt               # POST bodies
├── suspicious-dns.txt          # DNS anomalies
├── beacon-candidates.txt       # Potential C2 beacons
├── large-transfers.txt         # Data exfiltration candidates
├── extracted/                  # Files pulled from traffic
│   ├── http/
│   ├── smb/
│   └── ftp/
└── extracted-metadata.json     # Metadata from extracted files
```

## Next Phase

Pass findings to `forensic-report` for full IR report with timeline.
