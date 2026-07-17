---
name: proto-dns
description: "DNS security testing — zone transfer, DNS cache poisoning, DNS amplification, subdomain enumeration via brute force, DNSSEC bypass, DNS rebinding. Triggers: 'dns security', 'dns pentest', 'zone transfer', 'axfr', 'dns enum', 'dns attack', 'dns rebinding', 'dns cache poisoning', 'dns amplification', 'dnssec'."
---

# DNS Security Testing

Enumerate DNS records, test for zone transfers, and identify DNS misconfigurations.

---

## Phase 1: DNS Enumeration

```bash
TARGET="target.com"

# Record enumeration:
dig "$TARGET" ANY +short 2>/dev/null | tee output/dns_records.txt
dig "$TARGET" A +short >> output/dns_records.txt
dig "$TARGET" AAAA +short >> output/dns_records.txt
dig "$TARGET" MX +short >> output/dns_records.txt
dig "$TARGET" TXT +short >> output/dns_records.txt
dig "$TARGET" NS +short >> output/dns_records.txt
dig "$TARGET" SOA +short >> output/dns_records.txt
dig "_dmarc.$TARGET" TXT +short >> output/dns_records.txt

# DKIM/SPF/DMARC check:
dig "default._domainkey.$TARGET" TXT +short  # DKIM
dig "$TARGET" TXT +short | grep "v=spf1"  # SPF
dig "_dmarc.$TARGET" TXT +short  # DMARC
```

---

## Phase 2: Zone Transfer

```bash
TARGET="target.com"

# Get nameservers:
NS_SERVERS=$(dig "$TARGET" NS +short | tr -d '.')
for NS in $NS_SERVERS; do
  echo "=== Trying zone transfer from: $NS ==="
  dig @$NS "$TARGET" AXFR 2>/dev/null | tee output/zone_transfer_$NS.txt
  # If successful: reveals ALL DNS records
done
```

---

## Phase 3: Subdomain Brute Force

```bash
TARGET="target.com"

# DNSx / Gobuster:
dnsx -d "$TARGET" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -a -resp -silent | tee output/dns_brute.txt

gobuster dns -d "$TARGET" -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -t 50 -o output/gobuster_dns.txt 2>/dev/null

# Massdns brute:
massdns -r /opt/resolvers.txt -t A \
  -o S -w output/massdns_results.txt \
  /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt 2>/dev/null
```

---

## Phase 4: DNS Security Tests

```bash
TARGET="target.com"

# DNS cache poisoning test (Kaminsky attack style):
# Check if resolver is vulnerable:
# https://dnsprivacy.org/ or use dnschef

# DNS amplification potential:
dig @TARGET.NS_IP "$TARGET" ANY

# DNSSEC validation:
dig "$TARGET" DNSKEY +dnssec | grep -i "RRSIG\|DNSKEY"

# DNS rebinding (for SSRF testing):
# Create rebinding domain at https://lock.cmpxchg8b.com/rebinder.html
# Returns: ATTACKER_IP first, then 127.0.0.1 on subsequent queries
```

---

## Output

Save to `output/`:
- `dns_records.txt` — all DNS record types
- `zone_transfer_*.txt` — zone transfer results
- `dns_brute.txt` — brute force subdomain results

## Next Phase

→ `recon-subdomain` for subdomain takeover assessment
→ `recon-asn-whois` for IP range enumeration
