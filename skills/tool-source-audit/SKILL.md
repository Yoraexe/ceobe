---
name: tool-source-audit
description: "Manual source code security audit — PHP/Python/Node/Java code review, dangerous function patterns, file inclusion vulnerabilities, SQL injection in ORM, authentication logic flaws. Triggers: 'source code audit', 'code review security', 'manual code review', 'php audit', 'python security review', 'java code audit', 'source code vulnerability', 'code audit'."
---

# Manual Source Code Security Audit

Structured manual review of application source code for security vulnerabilities.

---

## Phase 1: Quick Win Grep Patterns

```bash
TARGET_DIR="./src"

# PHP dangerous functions:
grep -rn "eval\|exec\|system\|passthru\|shell_exec\|popen\|proc_open\|assert" \
  "$TARGET_DIR" --include="*.php" | grep -v "//\|#.*eval" | tee output/php_dangerous.txt

# Unserialize (deserialization):
grep -rn "unserialize\|deserialize\|pickle.loads\|ObjectInputStream\|yaml.load" \
  "$TARGET_DIR" | grep -v "//\|test\|spec" | tee output/deserialization.txt

# SQL concatenation:
grep -rn '"\(SELECT\|INSERT\|UPDATE\|DELETE\|DROP\).*"\s*\.\s*\$\|query(.*\+\|execute(.*\+' \
  "$TARGET_DIR" | tee output/sql_concat.txt

# File include:
grep -rn "include\|require\|include_once\|require_once" "$TARGET_DIR" --include="*.php" | \
  grep '\$' | tee output/file_include.txt

# Hardcoded credentials:
grep -rniE '(password|passwd|secret|api_key|apikey|token)\s*=\s*"[^"]{4,}"' \
  "$TARGET_DIR" | grep -v "test\|example\|sample\|//\|#" | tee output/hardcoded_creds.txt
```

---

## Phase 2: Language-Specific Audit

```bash
TARGET_DIR="./src"

# Python:
grep -rn "subprocess\.\(call\|run\|Popen\)\|os\.system\|os\.popen\|commands\." \
  "$TARGET_DIR" --include="*.py" | tee output/python_exec.txt
grep -rn "render_template_string\|Markup\|jinja2.*from_string" \
  "$TARGET_DIR" --include="*.py" | tee output/python_ssti.txt

# Node.js:
grep -rn "eval\|new Function\|child_process\.\(exec\|spawn\)\|require('shell')" \
  "$TARGET_DIR" --include="*.js" --include="*.ts" | tee output/node_dangerous.txt

# Java:
grep -rn "Runtime.getRuntime\|ProcessBuilder\|exec(\|ScriptEngine\|Invoke-" \
  "$TARGET_DIR" --include="*.java" | tee output/java_exec.txt
grep -rn "ObjectInputStream\|readObject\|fromXML\|parseExpression\|SpelExpressionParser" \
  "$TARGET_DIR" --include="*.java" | tee output/java_deser.txt
```

---

## Phase 3: Authentication & Authorization

```bash
TARGET_DIR="./src"

# Missing auth checks:
grep -rn "is_admin\|is_authenticated\|@login_required\|checkPermission\|authorize" \
  "$TARGET_DIR" | tee output/auth_checks.txt

# JWT handling:
grep -rn "jwt\|JsonWebToken\|PyJWT\|jsonwebtoken" "$TARGET_DIR" | \
  grep -i "verify\|decode\|secret\|algorithm" | tee output/jwt_handling.txt

# Session fixation:
grep -rn "session_id\|PHPSESSID\|session\.regenerate\|session_regenerate_id" \
  "$TARGET_DIR" | tee output/session_handling.txt

# CORS misconfiguration:
grep -rn "Access-Control-Allow-Origin\|cors\|CORS" "$TARGET_DIR" | \
  grep -i "'\*'\|origin: \*\|true" | tee output/cors_config.txt
```

---

## Phase 4: Data Flow Analysis

```bash
TARGET_DIR="./src"

# User input sources:
grep -rn "\$_GET\|\$_POST\|\$_REQUEST\|\$_COOKIE\|request\.\(args\|form\|json\|data\)\|params\[" \
  "$TARGET_DIR" | tee output/user_inputs.txt

# Output sinks (potential XSS):
grep -rn "echo\|print\|printf\|innerHTML\|document\.write\|\.html(\|\.append(" \
  "$TARGET_DIR" | grep -i "get\|post\|request\|param\|query" | tee output/output_sinks.txt
```

---

## Output

Save to `output/`:
- `php_dangerous.txt` — dangerous function calls
- `hardcoded_creds.txt` — embedded credentials
- `auth_checks.txt` — authorization check locations

## Next Phase

→ `tool-semgrep` for automated SAST on top of manual findings
→ `vuln-rce` to exploit command injection findings
