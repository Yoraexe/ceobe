---
name: recon-secrets
description: "Secrets and credential exposure scanning — gitleaks, trufflehog, JS secret scanning, S3 bucket secrets, environment variables, hardcoded credentials in source code. Triggers: 'secret scanning', 'credential scan', 'hardcoded secrets', 'api key leak', 'gitleaks', 'trufflehog', 'secret detection', 'env variable leak', 'secret in code'."
---

# Secrets & Credential Exposure Scanning

Find hardcoded credentials, API keys, and tokens in source code and web assets.

---

## Phase 1: JavaScript Secret Scanning

```bash
TARGET="https://TARGET"

# Collect all JS files:
gau "$TARGET" 2>/dev/null | grep -iE '\.js(\?|$)' | sort -u > /tmp/js_urls.txt
cat output/historical_urls.txt 2>/dev/null | grep -iE '\.js(\?|$)' | sort -u >> /tmp/js_urls.txt
sort -u /tmp/js_urls.txt -o /tmp/js_urls.txt
echo "[+] JS files: $(wc -l < /tmp/js_urls.txt)"

# Download and scan:
mkdir -p /tmp/js_files
while IFS= read -r URL; do
  FILENAME=$(echo "$URL" | md5sum | cut -d' ' -f1).js
  curl -s "$URL" > "/tmp/js_files/$FILENAME" 2>/dev/null
done < /tmp/js_urls.txt

# Gitleaks scan:
gitleaks detect --source /tmp/js_files --no-git -v 2>&1 | tee output/js_secrets.txt

# Pattern-based scan:
grep -rE '(api[_-]?key|apikey|api[_-]?secret|access[_-]?token|secret[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token|bearer|password)["\s]*[=:]["\s]*[a-zA-Z0-9_\-]{20,}' \
  /tmp/js_files/ | tee -a output/js_secrets.txt
```

---

## Phase 2: Git Repository Scanning

```bash
TARGET_ORG="target-org"  # GitHub org name

# Scan public repos with trufflehog:
trufflehog github --org="$TARGET_ORG" \
  --only-verified \
  --json 2>&1 | tee output/trufflehog_github.txt

# Scan specific repo:
trufflehog git "https://github.com/$TARGET_ORG/main-app" \
  --json 2>&1 | tee output/trufflehog_repo.txt

# Gitleaks on cloned repo:
git clone "https://github.com/$TARGET_ORG/main-app" /tmp/target_repo 2>/dev/null
gitleaks detect --source /tmp/target_repo -v 2>&1 | tee output/gitleaks_repo.txt

# TruffleHog on entire git history:
trufflehog git --since-commit HEAD~100 /tmp/target_repo --json 2>&1 | tee output/trufflehog_history.txt
```

---

## Phase 3: Environment & Config Files

```bash
TARGET="https://TARGET"

# Direct access attempts:
SECRET_FILES=(
  "/.env" "/.env.local" "/.env.prod" "/.env.production"
  "/config/database.yml" "/config/secrets.yml"
  "/application.properties" "/application.yml"
  "/.aws/credentials" "/wp-config.php"
  "/config.php" "/settings.py" "/config.json"
  "/appsettings.json" "/web.config"
)

for FILE in "${SECRET_FILES[@]}"; do
  RESP=$(curl -s -o /tmp/resp -w "%{http_code}" "$TARGET$FILE")
  if [ "$RESP" == "200" ]; then
    echo "FOUND: $TARGET$FILE"
    grep -iE "(key|secret|password|token|auth|db_|aws_)" /tmp/resp | head -5
  fi
done | tee output/exposed_configs.txt

# Grep for specific patterns in found files:
grep -rE "([A-Za-z0-9+/]{40}={0,2})" output/exposed_configs.txt | head -20  # base64 secrets
grep -rE "AKIA[0-9A-Z]{16}" output/exposed_configs.txt  # AWS access keys
grep -rE "sk_live_[a-zA-Z0-9]{24}" output/exposed_configs.txt  # Stripe keys
```

---

## Phase 4: Cloud & SaaS Credential Patterns

```bash
# Known secret formats:
echo "Checking for known secret patterns:"

grep -rE "AKIA[0-9A-Z]{16}" /tmp/js_files/ && echo "FOUND: AWS Access Key"
grep -rE "sk_live_[a-zA-Z0-9]{24}" /tmp/js_files/ && echo "FOUND: Stripe Live Key"
grep -rE "ghp_[a-zA-Z0-9]{36}" /tmp/js_files/ && echo "FOUND: GitHub Personal Access Token"
grep -rE "xoxb-[0-9]+-[a-zA-Z0-9]+" /tmp/js_files/ && echo "FOUND: Slack Bot Token"
grep -rE "SG\.[a-zA-Z0-9_]{22}\.[a-zA-Z0-9_]{43}" /tmp/js_files/ && echo "FOUND: SendGrid API Key"
grep -rE "eyJhbGc" /tmp/js_files/ | head -3 && echo "FOUND: JWT Token (may be valid)"
```

---

## Output

Save to `output/`:
- `js_secrets.txt` — secrets found in JavaScript
- `trufflehog_github.txt` — GitHub repo secrets
- `gitleaks_repo.txt` — git history secrets
- `exposed_configs.txt` — directly accessible config files

## Next Phase

→ Validate found credentials and assess access scope
→ `pentest-report` to document secrets with impact assessment
