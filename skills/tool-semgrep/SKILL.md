---
name: tool-semgrep
description: "Semgrep static analysis for security — SAST rules, custom rules, secret detection, code pattern matching, OWASP Top 10 detection, CI/CD integration. Triggers: 'semgrep', 'sast', 'static analysis', 'source code scan', 'semgrep rule', 'code security scan', 'semgrep owasp', 'static application security testing'."
---

# Semgrep Static Analysis

Pattern-based SAST for finding security bugs in source code.

---

## Phase 1: Basic Scanning

```bash
TARGET_DIR="./src"

# Community security rules:
semgrep --config "p/security-audit" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_security.txt

# OWASP Top 10:
semgrep --config "p/owasp-top-ten" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_owasp.txt

# Language-specific:
semgrep --config "p/python" "$TARGET_DIR" 2>/dev/null
semgrep --config "p/javascript" "$TARGET_DIR" 2>/dev/null
semgrep --config "p/java" "$TARGET_DIR" 2>/dev/null
semgrep --config "p/php" "$TARGET_DIR" 2>/dev/null
semgrep --config "p/go" "$TARGET_DIR" 2>/dev/null

# Secret detection:
semgrep --config "p/secrets" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_secrets.txt
```

---

## Phase 2: Targeted Security Checks

```bash
TARGET_DIR="./src"

# SQL injection patterns:
semgrep --config "p/sql-injection" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_sqli.txt

# Command injection:
semgrep --config "p/command-injection" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_cmdi.txt

# Insecure cryptography:
semgrep --config "p/insecure-transport" "$TARGET_DIR" 2>/dev/null

# JWT issues:
semgrep --config "p/jwt" "$TARGET_DIR" 2>/dev/null

# XSS:
semgrep --config "p/xss" "$TARGET_DIR" 2>/dev/null | tee output/semgrep_xss.txt
```

---

## Phase 3: Custom Rules

```bash
TARGET_DIR="./src"

# Write custom rule:
cat > /tmp/custom_rules.yaml << 'EOF'
rules:
  - id: hardcoded-password
    pattern: |
      password = "..."
    message: Hardcoded password found
    severity: ERROR
    languages: [python, javascript]

  - id: unsafe-eval
    pattern: eval(...)
    message: Use of eval() — potential code injection
    severity: WARNING
    languages: [python, javascript]

  - id: sql-concat
    pattern: |
      $Q = "SELECT ... " + $VAR
    message: SQL concatenation — potential SQL injection
    severity: ERROR
    languages: [python, java]
EOF

semgrep --config /tmp/custom_rules.yaml "$TARGET_DIR" 2>/dev/null | tee output/semgrep_custom.txt
```

---

## Phase 4: JSON Output & CI/CD

```bash
TARGET_DIR="./src"

# JSON output for automation:
semgrep --config "p/security-audit" --json "$TARGET_DIR" 2>/dev/null | \
  jq '.results[] | {file: .path, line: .start.line, rule: .check_id, msg: .extra.message}' | \
  tee output/semgrep_findings.json

# SARIF output (for GitHub Security tab):
semgrep --config "p/security-audit" --sarif "$TARGET_DIR" 2>/dev/null > output/semgrep.sarif

# Count by severity:
semgrep --config "p/security-audit" --json "$TARGET_DIR" 2>/dev/null | \
  jq '.results | group_by(.extra.severity) | map({severity: .[0].extra.severity, count: length})'
```

---

## Output

Save to `output/`:
- `semgrep_security.txt` — general security findings
- `semgrep_secrets.txt` — hardcoded secret findings
- `semgrep_findings.json` — structured findings

## Next Phase

→ Manual verification of SAST findings
→ `tool-source-audit` for deeper manual code review
