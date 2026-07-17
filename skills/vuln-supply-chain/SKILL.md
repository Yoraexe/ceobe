---
name: vuln-supply-chain
description: "Supply chain security testing — dependency confusion, typosquatting, npm/PyPI package hijacking, malicious dependency injection, CI/CD pipeline attacks, GitHub Actions poisoning. Triggers: 'supply chain', 'dependency confusion', 'typosquatting', 'package hijacking', 'npm package attack', 'dependency injection', 'supply chain attack', 'third party risk'."
---

# Supply Chain Security Testing

Test for dependency confusion, typosquatting, and third-party package abuse.

---

## Phase 1: Dependency Enumeration

```bash
TARGET_REPO="https://github.com/TARGET/app"

# Clone/get dependency files:
curl -s "$TARGET_REPO/raw/main/package.json" | jq '.dependencies, .devDependencies' | tee output/npm_deps.txt
curl -s "$TARGET_REPO/raw/main/requirements.txt" | tee output/python_deps.txt
curl -s "$TARGET_REPO/raw/main/Gemfile" | tee output/ruby_deps.txt
curl -s "$TARGET_REPO/raw/main/composer.json" | jq '.require' | tee output/php_deps.txt

# Check if any packages are internal/private (high-value for dependency confusion):
# Look for package names starting with @company/ or non-standard names
cat output/npm_deps.txt | jq 'keys[]' | grep -v '@'
```

---

## Phase 2: Dependency Confusion

```bash
# Dependency confusion: register public package with same name as private internal package
# If app uses @internal/auth-lib, register auth-lib on npm with higher version

# Check if internal package exists on public registry:
while IFS= read -r PKG; do
  PKG=$(echo "$PKG" | tr -d '"')
  npm_status=$(curl -s "https://registry.npmjs.org/$PKG" | jq -r '.name // "NOT_FOUND"')
  echo "$PKG → npm: $npm_status"
done < <(cat output/npm_deps.txt | jq 'keys[]' | grep -v '^"@' | tr -d '"')

# Pip packages:
while IFS= read -r PKG; do
  PKG=$(echo "$PKG" | cut -d'=' -f1 | cut -d'>' -f1 | tr -d ' ')
  pypi_status=$(curl -s "https://pypi.org/pypi/$PKG/json" | jq -r '.info.name // "NOT_FOUND"')
  echo "$PKG → PyPI: $pypi_status"
done < output/python_deps.txt | grep "NOT_FOUND" | tee output/confusion_candidates.txt
```

---

## Phase 3: Typosquatting Check

```bash
# Common typosquatting patterns for dependency names:
# Missing letter, swapped letters, extra letter, similar char substitution

# Check legitimate packages vs squatted versions:
LEGIT_PKGS=("requests" "lodash" "express" "django" "flask" "boto3" "axios" "react")
for PKG in "${LEGIT_PKGS[@]}"; do
  # Check variations:
  for SQUATTED in "${PKG}s" "${PKG}z" "${PKG}_lib" "the-${PKG}" "py${PKG}"; do
    npm_status=$(curl -s "https://registry.npmjs.org/$SQUATTED" -o /dev/null -w "%{http_code}")
    [ "$npm_status" == "200" ] && echo "SQUATTED: $SQUATTED (npm)"
  done
done | tee output/typosquatting.txt
```

---

## Phase 4: CI/CD Pipeline Attack Surface

```bash
TARGET_REPO="https://github.com/TARGET/app"

# Check GitHub Actions workflows for untrusted input:
curl -s "$TARGET_REPO/raw/main/.github/workflows/main.yml" | \
  grep -iE "run:|uses:|github.event.issue|github.event.pull_request" | head -20

# Check for third-party actions pinned by hash vs tag:
curl -s "$TARGET_REPO/raw/main/.github/workflows/main.yml" | \
  grep "uses:" | grep -v "@[a-f0-9]\{40\}" | tee output/unpinned_actions.txt

# Check for secrets in workflow env:
curl -s "$TARGET_REPO/raw/main/.github/workflows/main.yml" | \
  grep -iE "env:|secrets\." | head -20
```

---

## Output

Save to `output/`:
- `confusion_candidates.txt` — packages not on public registry (confusion targets)
- `typosquatting.txt` — potential typosquatted packages
- `unpinned_actions.txt` — GitHub Actions using mutable refs

## Next Phase

→ `tech-git-platforms` for GitHub-specific misconfigs
→ `pentest-report` to document supply chain risks
