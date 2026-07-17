---
name: recon-asn-whois
description: "ASN, WHOIS, and OSINT reconnaissance — IP range discovery via ASN, WHOIS pivoting, BGP intelligence, CIDR block enumeration, IP history, corporate netblock mapping. Triggers: 'asn recon', 'asn lookup', 'whois recon', 'ip range', 'netblock', 'bgp intel', 'cidr enum', 'ip history', 'corporate ip', 'asn enumeration'."
---

# ASN / WHOIS / BGP Reconnaissance

Discover the full IP space and network infrastructure owned by a target organization.

---

## Phase 1: ASN Discovery

```bash
TARGET="Target Corp"
TARGET_DOMAIN="target.com"

# Find ASN via company name:
curl -s "https://api.bgpview.io/search?query_term=$TARGET" | jq '.data.asns[] | {asn, name, description}'

# Via IP or domain:
TARGET_IP=$(dig +short "$TARGET_DOMAIN" | head -1)
curl -s "https://api.bgpview.io/ip/$TARGET_IP" | jq '.data.prefixes[] | {prefix, asn: .asn.asn, name: .asn.name}'

# Using asn.sh:
curl -s "https://asn.sh/$TARGET_IP" | head -20

# whois CIDR lookup:
whois "$TARGET_DOMAIN" | grep -iE "netrange|cidr|inetnum|network"
whois "$TARGET_IP" | grep -iE "netrange|cidr|inetnum|network|orgname"
```

---

## Phase 2: IP Range Enumeration

```bash
ASN_NUMBER="AS12345"  # replace with target ASN

# Get all prefixes for an ASN:
curl -s "https://api.bgpview.io/asn/$ASN_NUMBER/prefixes" | \
  jq '.data.ipv4_prefixes[].prefix' | tr -d '"' | tee output/ip_ranges.txt

# Via RIPE/ARIN/APNIC:
curl -s "https://rest.db.ripe.net/search.json?query-string=$ASN_NUMBER&type-filter=route" | \
  jq '.objects.object[] | .attributes.attribute[] | select(.name=="route") | .value' | tee -a output/ip_ranges.txt

# Enumerate IPs in range:
while IFS= read -r CIDR; do
  prips "$CIDR" 2>/dev/null | head -10
  echo "..."
done < output/ip_ranges.txt | head -100

# Nmap scan of IP ranges:
nmap -sn -iL output/ip_ranges.txt --open -oG output/asn_live_hosts.txt 2>/dev/null
grep "Up" output/asn_live_hosts.txt | awk '{print $2}' > output/asn_live_ips.txt
```

---

## Phase 3: WHOIS Pivoting

```bash
TARGET="target.com"

# WHOIS org/email pivoting:
whois "$TARGET" | grep -iE "registrant|admin|tech|email" | sort -u > /tmp/whois_contacts.txt
cat /tmp/whois_contacts.txt

# Find other domains registered by same email/org:
REGISTRANT_EMAIL=$(grep -i "email" /tmp/whois_contacts.txt | head -1 | awk '{print $NF}')
# Search on tools: https://viewdns.info/reversewhois/ or domaintools
curl -s "https://viewdns.info/reversewhois/?q=$REGISTRANT_EMAIL" | grep -oE '[a-zA-Z0-9.-]+\.[a-z]{2,}' | \
  grep -v "viewdns\|google\|facebook\|twitter" | sort -u | tee output/whois_pivot_domains.txt

# Certificate transparency for discovered domains:
while IFS= read -r DOM; do
  curl -s "https://crt.sh/?q=%25.$DOM&output=json" 2>/dev/null | \
    jq -r '.[].name_value' | sed 's/\*\.//g' | sort -u
done < output/whois_pivot_domains.txt | sort -u | tee output/whois_pivot_subdomains.txt
```

---

## Phase 4: IP History & Hosting Intel

```bash
TARGET="target.com"

# IP history (bypass Cloudflare/CDN to find origin):
curl -s "https://api.hackertarget.com/hostsearch/?q=$TARGET" | tee output/ip_history.txt
curl -s "https://api.viewdns.info/iphistory/?domain=$TARGET&apikey=API_KEY" | jq '.'

# Shodan for IP-based discovery:
shodan host "$TARGET" 2>/dev/null | head -30

# Reverse DNS on CIDR:
while IFS= read -r IP; do
  PTR=$(dig +short -x "$IP" 2>/dev/null)
  [ -n "$PTR" ] && echo "$IP → $PTR"
done < output/asn_live_ips.txt | tee output/rdns_results.txt
```

---

## Output

Save to `output/`:
- `ip_ranges.txt` — CIDR blocks belonging to target
- `asn_live_ips.txt` — live IPs within ASN
- `whois_pivot_domains.txt` — related domains via WHOIS
- `rdns_results.txt` — reverse DNS mappings

## Next Phase

→ `recon-subdomain` for subdomain enumeration
→ `recon-shodan` for service discovery on discovered IPs
