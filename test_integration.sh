#!/bin/bash
BASE="http://localhost:8000"
KEY="sk_test_mer_INvQlGxl0u_ScRjRTROH3erzKPHDe9aQtLR5fg"
P=0; F=0

ok(){ echo "  ✅ $1"; P=$((P+1)); }
fail(){ echo "  ❌ $1"; echo "     $2"; F=$((F+1)); }

echo "╔══════════════════════════════════════════════╗"
echo "║  RailSwitch System Integration Test          ║"
echo "╚══════════════════════════════════════════════╝"

# ─── CHAIN 1: Complete Merchant Flow ───
echo ""
echo "═══ CHAIN 1: Complete Merchant Flow ═══"

TSTAMP=$(date +%s)
REG=$(curl -s -X POST "$BASE/v1/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"ChainTest\",\"email\":\"chain$TSTAMP@test.dev\",\"password\":\"password123\"}")
NEW_KEY=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('api_key',''))" 2>/dev/null)
[[ -n "$NEW_KEY" ]] && ok "Register merchant" || fail "Register" "$REG"

LOGIN=$(curl -s -X POST "$BASE/v1/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"chain$TSTAMP@test.dev\",\"password\":\"password123\"}")
echo "$LOGIN" | grep -q "merchant" && ok "Login" || fail "Login" "$LOGIN"

# The login email doesn't match because it regenerated - use the original key
[[ -z "$NEW_KEY" ]] && { echo "Cannot continue - registration failed"; exit 1; }

P1=$(curl -s -X POST "$BASE/v1/plans" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Basic","description":"Basic","amount":500000,"currency":"NGN","interval":"monthly","interval_count":1}')
PLAN1=$(echo "$P1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[[ -n "$PLAN1" ]] && ok "Create plan (₹5,000/mo)" || fail "Create plan" "$P1"

P2=$(curl -s -X POST "$BASE/v1/plans" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Premium","description":"Premium","amount":1500000,"currency":"NGN","interval":"monthly","interval_count":1}')
PLAN2=$(echo "$P2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[[ -n "$PLAN2" ]] && ok "Create plan (₹15,000/mo)" || fail "Create plan" "$P2"

L=$(curl -s "$BASE/v1/plans" -H "Authorization: Bearer $NEW_KEY")
echo "$L" | grep -q '"id"' && ok "List plans" || fail "List plans" "$L"

C=$(curl -s -X POST "$BASE/v1/customers" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d '{"email":"ada@test.dev","name":"Adaeze"}')
CUST=$(echo "$C" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[[ -n "$CUST" ]] && ok "Create customer" || fail "Create customer" "$C"

S=$(curl -s -X POST "$BASE/v1/subscriptions" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUST\",\"plan_id\":\"$PLAN1\",\"start_date\":\"2026-06-29T00:00:00Z\"}")
SUB=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
echo "$S" | grep -q '"state":"active"' && ok "Create subscription (active)" || fail "Create subscription" "$S"

# ─── CHAIN 2: Proration ───
echo ""
echo "═══ CHAIN 2: Proration & Plan Change ═══"

PREV=$(curl -s -X POST "$BASE/v1/subscriptions/$SUB/preview" -H "Authorization: Bearer $NEW_KEY" \
  -H "Content-Type: application/json" -d "{\"new_plan_id\":\"$PLAN2\"}")
echo "$PREV" | grep -q "net_amount" && ok "Preview upgrade" || fail "Preview" "$PREV"

UP=$(curl -s -X PATCH "$BASE/v1/subscriptions/$SUB" -H "Authorization: Bearer $NEW_KEY" \
  -H "Content-Type: application/json" -d "{\"plan_id\":\"$PLAN2\"}")
echo "$UP" | grep -q "$PLAN2" && ok "Patch subscription (upgrade)" || fail "Patch subscription" "$UP"

# ─── CHAIN 3: Lifecycle ───
echo ""
echo "═══ CHAIN 3: Lifecycle (Pause/Resume/Cancel) ═══"

PAUSE=$(curl -s -X POST "$BASE/v1/subscriptions/$SUB/pause" -H "Authorization: Bearer $NEW_KEY")
echo "$PAUSE" | grep -q '"paused"' && ok "Pause subscription" || fail "Pause" "$PAUSE"

RESUME=$(curl -s -X POST "$BASE/v1/subscriptions/$SUB/resume" -H "Authorization: Bearer $NEW_KEY")
echo "$RESUME" | grep -q '"active"' && ok "Resume subscription" || fail "Resume" "$RESUME"

CANCEL=$(curl -s -X POST "$BASE/v1/subscriptions/$SUB/cancel" -H "Authorization: Bearer $NEW_KEY")
echo "$CANCEL" | grep -q '"cancelled"' && ok "Cancel subscription" || fail "Cancel" "$CANCEL"

# ─── CHAIN 4: Payment Methods ───
echo ""
echo "═══ CHAIN 4: Payment Methods ═══"

PM=$(curl -s -X POST "$BASE/v1/payment-methods" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUST\",\"type\":\"card\",\"nomba_token\":\"tok_visa_4242\",\"last4\":\"4242\",\"brand\":\"Visa\",\"exp_month\":\"12\",\"exp_year\":\"2028\",\"is_default\":true}")
PMID=$(echo "$PM" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[[ -n "$PMID" ]] && ok "Create payment method" || fail "Create PM" "$PM"

curl -s "$BASE/v1/payment-methods?customer_id=$CUST" -H "Authorization: Bearer $NEW_KEY" | grep -q "$PMID" && ok "List payment methods" || fail "List PMs"
curl -s "$BASE/v1/payment-methods/$PMID" -H "Authorization: Bearer $NEW_KEY" | grep -q "$PMID" && ok "Get payment method" || fail "Get PM"
curl -s -X DELETE "$BASE/v1/payment-methods/$PMID" -H "Authorization: Bearer $NEW_KEY" | grep -q "true" && ok "Delete payment method" || fail "Delete PM"

# ─── CHAIN 5: Webhooks ───
echo ""
echo "═══ CHAIN 5: Webhooks ═══"

WEP=$(curl -s -X POST "$BASE/v1/webhooks/endpoints" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://test.dev/webhook"}')
WEPID=$(echo "$WEP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
[[ -n "$WEPID" ]] && ok "Create webhook endpoint" || fail "Create endpoint" "$WEP"

curl -s "$BASE/v1/webhooks/endpoints" -H "Authorization: Bearer $NEW_KEY" | grep -q "url" && ok "List endpoints" || fail "List endpoints"
curl -s -X DELETE "$BASE/v1/webhooks/endpoints/$WEPID" -H "Authorization: Bearer $NEW_KEY" | grep -q "true" && ok "Delete endpoint" || fail "Delete endpoint"
curl -s "$BASE/v1/webhooks/events" -H "Authorization: Bearer $NEW_KEY" | grep -q "data" && ok "List events" || fail "List events"
curl -s "$BASE/v1/webhooks/deliveries" -H "Authorization: Bearer $NEW_KEY" | grep -q "data" && ok "List deliveries" || fail "List deliveries"

# ─── CHAIN 6: Invoices ───
echo ""
echo "═══ CHAIN 6: Invoice Operations ═══"

curl -s "$BASE/v1/invoices" -H "Authorization: Bearer $NEW_KEY" | grep -q "data" && ok "List invoices" || fail "List invoices"
curl -s -X POST "$BASE/v1/invoices/inv_nonexistent/retry" -H "Authorization: Bearer $NEW_KEY" | grep -q "RESOURCE_NOT_FOUND" && ok "Retry nonexistent (404)" || fail "Retry"
curl -s -X POST "$BASE/v1/invoices/inv_nonexistent/refund" -H "Authorization: Bearer $NEW_KEY" | grep -q "RESOURCE_NOT_FOUND" && ok "Refund nonexistent (404)" || fail "Refund"

# ─── CHAIN 7: Error Handling ───
echo ""
echo "═══ CHAIN 7: Error Handling ═══"

curl -s "$BASE/v1/plans/nonexistent" -H "Authorization: Bearer $NEW_KEY" | grep -q "RESOURCE_NOT_FOUND" && ok "404 on missing plan" || fail "Missing plan"
curl -s -X POST "$BASE/v1/plans" -H "Authorization: Bearer $NEW_KEY" -H "Content-Type: application/json" -d '{}' | grep -q "422" && ok "422 on missing fields" || fail "Missing fields"
curl -s "$BASE/v1/whoami" -H "Authorization: Bearer bad_key" | grep -q "401" && ok "401 on bad auth" || fail "Bad auth"

echo ""
echo "══════════════════════════════════════════════"
echo "  Results: $P passed, $F failed"
echo "══════════════════════════════════════════════"
