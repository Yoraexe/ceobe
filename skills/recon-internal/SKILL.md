---
name: recon-internal
description: "Internal network penetration test reconnaissance — network discovery, service enumeration, LDAP/AD enumeration, SMB shares, internal web apps, printer discovery. Triggers: 'internal pentest', 'internal recon', 'internal network', 'lan recon', 'intranet recon', 'active directory recon', 'internal service discovery', 'network scan internal'."
---

# Internal Penetration Test Reconnaissance

Systematic discovery of internal network assets, services, and entry points.

---

## Phase 1: Network Discovery

```bash
SUBNET="10.10.10.0/24"  # adjust to target subnet

# ARP scan (fastest, Layer 2):
arp-scan -l --localnet 2>/dev/null | tee output/arp_scan.txt
# Or if subnet specified:
arp-scan "$SUBNET" 2>/dev/null | tee output/arp_scan.txt

# Netdiscover (passive + active):
netdiscover -r "$SUBNET" -p 2>/dev/null | head -30

# Nmap ping sweep:
nmap -sn "$SUBNET" --open -oG output/ping_sweep.txt 2>/dev/null
grep "Up" output/ping_sweep.txt | awk '{print $2}' > output/live_hosts.txt
echo "[+] Live hosts: $(wc -l < output/live_hosts.txt)"

# Get current network info:
ip route show
ip addr show
cat /etc/resolv.conf
```

---

## Phase 2: Port Scanning

```bash
# Fast top-1000 ports scan:
nmap -sV -sC --open -iL output/live_hosts.txt \
  -oA output/nmap_initial --min-rate 3000 2>/dev/null | tee output/nmap_initial.txt

# Full port scan on key hosts:
KEY_HOST="10.10.10.100"
nmap -sV -sC -p- --open "$KEY_HOST" -oA output/nmap_full_$KEY_HOST 2>/dev/null

# Service-specific scripts:
nmap -sV -sC -p 139,445 --script smb-enum-shares,smb-enum-users,smb-vuln-ms17-010 \
  -iL output/live_hosts.txt -oA output/nmap_smb 2>/dev/null
nmap -sV -sC -p 389,636 --script ldap-rootdse,ldap-search \
  -iL output/live_hosts.txt -oA output/nmap_ldap 2>/dev/null
nmap -p 161 --script snmp-info,snmp-sysdescr -iL output/live_hosts.txt -oA output/nmap_snmp 2>/dev/null
```

---

## Phase 3: Active Directory Enumeration

```bash
DC_IP="10.10.10.100"
DOMAIN="target.local"
# With credentials:
USER="testuser"
PASS="Password123"

# LDAP enumeration:
ldapsearch -H "ldap://$DC_IP" -x -b "DC=target,DC=local" \
  "(objectclass=user)" sAMAccountName userPrincipalName | grep -E "sAMAccountName:|userPrincipalName:" | \
  tee output/ad_users.txt

ldapsearch -H "ldap://$DC_IP" -x -b "DC=target,DC=local" \
  "(objectclass=group)" cn | grep "cn:" | tee output/ad_groups.txt

# BloodHound collection:
bloodhound-python -u "$USER" -p "$PASS" -ns "$DC_IP" -d "$DOMAIN" \
  -c All --zip 2>/dev/null

# Without credentials (anonymous LDAP):
ldapsearch -H "ldap://$DC_IP" -x -s base namingcontexts
```

---

## Phase 4: Internal Service Discovery

```bash
# Web services:
httpx -l output/live_hosts.txt -ports 80,443,8080,8443,8000,3000 \
  -silent -title -status-code -o output/internal_web.txt 2>/dev/null

# SMB shares:
while IFS= read -r HOST; do
  smbclient -L "//$HOST" -N 2>/dev/null | grep -v "^$\|Sharename\|---------\|Workgroup" | \
    awk -v h="$HOST" '{print h" "$0}'
done < output/live_hosts.txt | tee output/smb_shares.txt

# Database services:
nmap -p 1433,3306,5432,27017,6379 -iL output/live_hosts.txt --open -oG output/db_services.txt 2>/dev/null

# Printers:
nmap -p 9100,515,631 --open -iL output/live_hosts.txt -oG output/printers.txt 2>/dev/null
```

---

## Output

Save to `output/`:
- `live_hosts.txt` — discovered live hosts
- `nmap_initial.*` — initial port scan results
- `ad_users.txt` — AD user accounts
- `internal_web.txt` — internal web applications

## Next Phase

→ `ad-attacks` for Active Directory exploitation
→ `proto-smb` for SMB-specific attacks
→ `pentest-exploit` for vulnerability exploitation
