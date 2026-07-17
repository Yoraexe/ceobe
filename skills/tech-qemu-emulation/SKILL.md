---
name: tech-qemu-emulation
description: "QEMU cross-architecture emulation for firmware analysis and exploit testing. ARM/MIPS/RISC-V binary execution, GDB debugging cross-arch, firmware extraction with binwalk, chroot emulation, IoT service testing, cross-compile exploitation. Triggers: 'qemu', 'arm emulation', 'mips emulation', 'firmware analysis', 'iot emulation', 'cross architecture', 'binwalk', 'firmwalker', 'embedded binary', 'cross compile'."
---

# QEMU Emulation — Cross-Architecture & Firmware Analysis

ARM/MIPS/RISC-V binaries on x86. IoT firmware chroot. GDB debugging.

## Install

```bash
# QEMU user-mode + system mode:
sudo apt-get install -y qemu-system-x86 qemu-system-arm qemu-system-mips \
  qemu-user qemu-user-static binfmt-support

# Cross-compilation toolchains:
sudo apt-get install -y gcc-arm-linux-gnueabihf gcc-aarch64-linux-gnu \
  gcc-mips-linux-gnu gcc-mipsel-linux-gnu

# Firmware tools:
sudo apt-get install -y binwalk
git clone https://github.com/craigz28/firmwalker /opt/firmwalker

pip install pwntools --break-system-packages
```

---

## Phase 1: User-Mode QEMU (Single Binary)

```bash
# Identify architecture:
file ./binary
readelf -h ./binary | grep "Machine\|Class\|Data"

# Run binary directly:
qemu-arm ./arm_binary                 # ARM 32-bit
qemu-aarch64 ./aarch64_binary        # ARM 64-bit
qemu-mips ./mips_binary              # MIPS big-endian
qemu-mipsel ./mipsel_binary          # MIPS little-endian
qemu-riscv64 ./riscv64_binary        # RISC-V 64-bit

# With library path (dynamic binaries):
qemu-arm -L /usr/arm-linux-gnueabihf ./arm_binary
qemu-mips -L /usr/mips-linux-gnu ./mips_binary

# Pass arguments and stdin:
qemu-arm ./binary arg1 arg2
echo "input" | qemu-arm ./binary
qemu-arm ./binary < input_file.txt

# GDB stub for debugging:
qemu-arm -g 1234 ./arm_binary  # waits on port 1234

# In second terminal:
gdb-multiarch ./arm_binary
(gdb) target remote :1234
(gdb) break main
(gdb) continue
(gdb) info registers
(gdb) disassemble
```

---

## Phase 2: Firmware Extraction

```bash
FIRMWARE="firmware.bin"

# Identify firmware type:
file "$FIRMWARE"
binwalk "$FIRMWARE"

# Extract:
binwalk -e "$FIRMWARE" -C firmware_extracted/
ls firmware_extracted/

# Manual extraction by offset:
dd if="$FIRMWARE" bs=1 skip=OFFSET count=SIZE of=extracted.bin

# Mount squashfs:
sudo mount -o loop firmware_extracted/*.squashfs /mnt/firmware
ls /mnt/firmware/

# Extract squashfs:
sudo unsquashfs firmware_extracted/*.squashfs
ls squashfs-root/

# Run firmwalker:
bash /opt/firmwalker/firmwalker.sh ./squashfs-root/ report.txt
cat report.txt | grep -E "passwd|shadow|config|ssl|private|key|certificate"
```

---

## Phase 3: Chroot Emulation (Full IoT Environment)

```bash
ROOT="./squashfs-root"

# Determine architecture:
file "$ROOT/bin/busybox"
# → ELF 32-bit MSB executable, MIPS = qemu-mips-static
# → ELF 32-bit LSB executable, ARM  = qemu-arm-static

# Copy static QEMU binary:
cp /usr/bin/qemu-mips-static "$ROOT/usr/bin/"
# OR: cp /usr/bin/qemu-arm-static "$ROOT/usr/bin/"

# Optional: mount proc/sys for full compatibility:
sudo mount -t proc proc "$ROOT/proc"
sudo mount -t sysfs sys "$ROOT/sys"
sudo mount -o bind /dev "$ROOT/dev"

# Enter chroot:
sudo chroot "$ROOT" /bin/sh

# Inside chroot — explore and test:
ls /
cat /etc/passwd
cat /etc/shadow
netstat -tlnp 2>/dev/null

# Start web service if present:
/usr/sbin/httpd &
/bin/busybox httpd -p 8080 -h /www &

# Test from host:
curl http://localhost:8080/
```

---

## Phase 4: System-Mode QEMU (Full VM)

```bash
# ARM system emulation:
qemu-img create -f qcow2 arm_disk.qcow2 4G

qemu-system-arm \
  -M virt \
  -cpu cortex-a15 \
  -m 512M \
  -kernel vmlinuz-arm \
  -initrd initrd.img-arm \
  -drive if=virtio,file=arm_disk.qcow2 \
  -append "root=/dev/vda1 console=ttyAMA0" \
  -nographic \
  -netdev user,id=net0,hostfwd=tcp::2222-:22 \
  -device virtio-net-device,netdev=net0

# SSH access:
ssh -p 2222 root@localhost

# MIPS system:
qemu-system-mips \
  -M malta \
  -cpu MIPS32r2-generic \
  -m 256M \
  -kernel vmlinux-mips \
  -nographic \
  -append "root=/dev/hda1 console=ttyS0" \
  -netdev user,id=net0,hostfwd=tcp::2223-:22 \
  -device e1000,netdev=net0

# Kernel CTF (from ctf-pwn-kernel skill):
qemu-system-x86_64 \
  -kernel bzImage \
  -initrd rootfs.cpio \
  -append "console=ttyS0 nokaslr nopti" \
  -m 128M \
  -nographic \
  -s    # GDB stub on :1234
```

---

## Phase 5: IoT Service Vulnerability Testing

```bash
# Find services in chroot:
ps aux 2>/dev/null | head -20
netstat -tlnp 2>/dev/null

# Test web interface:
curl http://localhost:8080/
curl http://localhost:8080/cgi-bin/admin.cgi
curl -u admin:admin http://localhost:8080/   # default creds

# Directory traversal:
curl "http://localhost:8080/../../etc/passwd"
curl "http://localhost:8080/?file=../../etc/shadow"

# Command injection in CGI:
curl "http://localhost:8080/cgi-bin/ping.cgi?host=127.0.0.1;id"
curl "http://localhost:8080/cgi-bin/apply.cgi" -d "cmd=ping&host=127.0.0.1;ls"

# Buffer overflow test:
python3 -c "print('A'*1000)" | curl "http://localhost:8080/cgi-bin/vuln.cgi" -d @-

# Hard-coded credentials from firmwalker:
grep -r "admin:admin\|root:root\|password=" squashfs-root/etc/ squashfs-root/www/ 2>/dev/null

# SSL private keys:
find squashfs-root/ -name "*.pem" -o -name "*.key" 2>/dev/null
grep -r "BEGIN PRIVATE KEY\|BEGIN RSA" squashfs-root/ 2>/dev/null
```

---

## Phase 6: Cross-Compile Exploits

```bash
# Compile for ARM:
arm-linux-gnueabihf-gcc exploit.c -o exploit_arm -static
qemu-arm ./exploit_arm

# Compile for MIPS:
mips-linux-gnu-gcc exploit.c -o exploit_mips -static
qemu-mips ./exploit_mips

# Shellcode for ARM with pwntools:
python3 << 'EOF'
from pwn import *
context.arch = 'arm'
context.endian = 'little'
shellcode = asm(shellcraft.arm.linux.sh())
print(hexdump(shellcode))
open('/tmp/arm_sc.bin', 'wb').write(shellcode)
EOF

# Test shellcode:
qemu-arm /tmp/arm_sc_runner  # wrap in small C caller
```

---

## Phase 7: Architecture Quick Reference

| Architecture | File output | qemu binary | GCC toolchain |
|:-------------|:------------|:------------|:--------------|
| ARM 32-bit | EM_ARM (40) | qemu-arm | arm-linux-gnueabihf-gcc |
| ARM 64-bit | EM_AARCH64 (183) | qemu-aarch64 | aarch64-linux-gnu-gcc |
| MIPS big-endian | EM_MIPS MSB | qemu-mips | mips-linux-gnu-gcc |
| MIPS little-endian | EM_MIPS LSB | qemu-mipsel | mipsel-linux-gnu-gcc |
| PowerPC | EM_PPC (20) | qemu-ppc | powerpc-linux-gnu-gcc |
| RISC-V 64-bit | EM_RISCV (243) | qemu-riscv64 | riscv64-linux-gnu-gcc |

---

## Output

Save to `.omop/engagement/tech/iot/`:
- `firmwalker-report.txt` — credential/key findings
- `web-vulns.txt` — web interface vulnerabilities
- `exploit` — compiled exploit for target arch

## Next Phase

→ `tech-frida-hooking` for mobile/binary dynamic analysis
→ `pentest-exploit` for exploitation phase
