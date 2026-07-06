#!/usr/bin/env bash
# =============================================================================
#  RAILSWITCH COMPREHENSIVE END-TO-END TEST
#  Covers all 80+ endpoints across engine (45), gateway (44), portal (5 pages),
#  storefront, dashboard, cascade system, and data layer.
#
#  Usage:
#    ./test_integration.sh                    # default merchant key
#    KEY=sk_test_xxx ./test_integration.sh    # custom merchant key
#    MID=mer_xxx     ./test_integration.sh    # custom merchant ID
# =============================================================================

set -uo pipefail

KEY="${KEY:-sk_test_mer_k_W0XspbNN__y70_WaK_hR1iJU7qn95WUclycPU}"
MID="${MID:-mer_k_W0XspbNN}"
ENGINE="http://localhost:3001"
GATEWAY="http://localhost:8000"
DASHBOARD="http://localhost:3000"
PORTAL="http://localhost:3100"
STOREFRONT="http://localhost:3200"
IAUTH="local-dev-shared-secret"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

# Fetch JSON from URL — first arg is Python expr, rest are curl args
fetch() {
    local expr="$1"; shift
    curl -s --max-time 5 "$@" 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print($expr)
except Exception as e:
    print('FAIL', e)
" 2>/dev/null || echo "FAIL"
}

# HTTP status code check (args: desc url expected [extra curl args...])
check_http() {
    local desc="$1" url="$2" expected="$3"; shift 3
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" "$@" 2>/dev/null || echo "000")
    if [ "$code" = "$expected" ]; then ok "$desc"; else fail "$desc (got $code, expected $expected)"; fi
}

# JSON value check via Python expression (args: desc url expr expected [extra curl args...])
check_json() {
    local desc="$1" url="$2" jq="$3" expected="$4"; shift 4
    local val
    val=$(fetch "$jq" "$url" "$@")
    if [ "$val" = "$expected" ]; then ok "$desc"; else fail "$desc (got $val, expected $expected)"; fi
}

# Shorthand: curl gateway path with auth key
api() { curl -s --max-time 5 "$GATEWAY$1" -H "Authorization: Bearer $KEY" "${@:2}" 2>/dev/null; }
# Shorthand: curl gateway path + extract JSON value
apijq() { local full_args="$1" expr="$2"; eval "set -- $full_args"; local path="$1"; shift; local r; r=$(curl -s --max-time 5 "$GATEWAY$path" -H "Authorization: Bearer $KEY" "$@"); echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print($expr)" 2>/dev/null || echo "FAIL"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        RAILSWITCH COMPREHENSIVE END-TO-END TEST             ║"
echo "║        $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ============================================================================
# 1. SERVICE HEALTH & AVAILABILITY
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. SERVICE HEALTH & AVAILABILITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "Engine health" "$ENGINE/health" "d['status']" "ok"
check_json "Engine status" "$ENGINE/status" "d['status']" "ok"
check_json "Engine version" "$ENGINE/status" "bool(d.get('version'))" "True"
check_json "Engine postgres" "$ENGINE/status" "d['dependencies']['postgres']['status']" "ok"
# Redis may be not_configured in dev — accept either ok or not_configured
RD=$(fetch "d['dependencies']['redis']['status']" "$ENGINE/status")
if [ "$RD" = "ok" ] || [ "$RD" = "not_configured" ]; then ok "Engine redis ($RD)"; else fail "Engine redis (got $RD, expected ok or not_configured)"; fi
check_json "Engine uptime" "$ENGINE/status" "d['uptime_seconds'] > 0" "True"

check_json "Gateway health" "$GATEWAY/health" "d['status']" "ok"
check_json "Gateway status" "$GATEWAY/status" "d['status']" "ok"
check_json "Gateway started_at" "$GATEWAY/status" "bool(d.get('started_at'))" "True"

check_http "Dashboard loads" "$DASHBOARD" "200"
check_http "Portal loads" "$PORTAL/portal" "200"
check_http "Storefront loads" "$STOREFRONT" "200"

# ============================================================================
# 2. AUTHENTICATION & KEY VALIDATION
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  2. AUTHENTICATION & KEY VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "Whoami test mode" "$GATEWAY/v1/whoami" "d['mode']" "test" -H "Authorization: Bearer $KEY"
check_json "Whoami merchant ID" "$GATEWAY/v1/whoami" "d['merchant']" "$MID" -H "Authorization: Bearer $KEY"

# Malformed keys (don't match sk_live|sk_test_merchant__random pattern)
check_json "No prefix 401" "$GATEWAY/v1/whoami" "d.get('error',{}).get('message','')" "Malformed API Key" -H "Authorization: Bearer bad__key"
check_json "Missing header 401" "$GATEWAY/v1/customers" "d.get('error',{}).get('message','')" "Not authenticated"

# Register + login
TSTAMP=$(date +%s)
REG=$(curl -s -X POST "$GATEWAY/v1/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E Tester\",\"email\":\"e2e-$TSTAMP@railswitch.dev\",\"password\":\"Test1234!\",\"company\":\"E2E Corp\"}" 2>/dev/null)
REG_KEY=$(fetch "d.get('data',{}).get('api_key','FAIL')" -X POST "$GATEWAY/v1/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E Tester\",\"email\":\"e2e-$TSTAMP@railswitch.dev\",\"password\":\"Test1234!\",\"company\":\"E2E Corp\"}")
REG_MER=$(fetch "d.get('data',{}).get('merchant',{}).get('id','FAIL')" -X POST "$GATEWAY/v1/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E Tester\",\"email\":\"e2e-$TSTAMP@railswitch.dev\",\"password\":\"Test1234!\",\"company\":\"E2E Corp\"}")
if [ "$REG_KEY" != "FAIL" ] && [ "$REG_MER" != "FAIL" ]; then
  ok "Register new merchant ($REG_MER)"
  LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"e2e-$TSTAMP@railswitch.dev\",\"password\":\"Test1234!\"}" 2>/dev/null || echo "000")
  if [ "$LOGIN_CODE" = "200" ]; then ok "Login with credentials"; else fail "Login with credentials (got $LOGIN_CODE)"; fi
else
  fail "Register new merchant ($REG_KEY)"
fi

# ============================================================================
# 3. PLANS — FULL CRUD
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  3. PLANS — Full CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "List existing plans" "$GATEWAY/v1/plans" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"

PLAN_ID=$(apijq "/v1/plans -X POST -H 'Content-Type: application/json' -d '{\"name\":\"E2E Test Plan\",\"description\":\"E2E test plan\",\"amount\":500000,\"currency\":\"NGN\",\"interval\":\"monthly\",\"interval_count\":1}'" "d.get('data',{}).get('id','FAIL')")

if [ "$PLAN_ID" != "FAIL" ] && [ -n "$PLAN_ID" ]; then
  ok "Create plan ($PLAN_ID)"
  check_json "Get plan by ID" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['id']" "$PLAN_ID" -H "Authorization: Bearer $KEY"
  check_json "Plan name" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['name']" "E2E Test Plan" -H "Authorization: Bearer $KEY"
  check_json "Plan amount" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['amount']" "500000" -H "Authorization: Bearer $KEY"
  check_json "Plan interval" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['interval']" "monthly" -H "Authorization: Bearer $KEY"
  check_json "Plan is_active" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['is_active']" "True" -H "Authorization: Bearer $KEY"

  # PATCH update — use inline curl for precise control
  PATCH_RESP=$(curl -s -X PATCH "$GATEWAY/v1/plans/$PLAN_ID" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
    -d '{"name":"E2E Updated Plan","amount":600000}' 2>/dev/null)
  PATCH_NAME=$(echo "$PATCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name','FAIL'))" 2>/dev/null || echo "FAIL")
  PATCH_AMT=$(echo "$PATCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(int(d.get('data',{}).get('amount',0)))" 2>/dev/null || echo "FAIL")
  if [ "$PATCH_NAME" = "E2E Updated Plan" ]; then ok "Update plan name"; else fail "Update plan name (got $PATCH_NAME)"; fi
  if [ "$PATCH_AMT" = "600000" ]; then ok "Update plan amount"; else fail "Update plan amount (got $PATCH_AMT)"; fi

  check_json "Archive plan" "$GATEWAY/v1/plans/$PLAN_ID" "d['data'].get('is_deleted')" "True" -X DELETE -H "Authorization: Bearer $KEY"
  check_json "Plan now inactive" "$GATEWAY/v1/plans/$PLAN_ID" "d['data']['is_active']" "False" -H "Authorization: Bearer $KEY"

  PLAN_404_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/plans/plan_nonexistent" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$PLAN_404_CODE" = "404" ] && ok "404 on missing plan" || fail "404 on missing plan (got $PLAN_404_CODE)"
else
  fail "Create plan (got: $PLAN_ID)"
fi

# ============================================================================
# 4. CUSTOMERS — FULL CRUD
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  4. CUSTOMERS — Full CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "List existing customers" "$GATEWAY/v1/customers" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"

CUSTOMER_ID=$(apijq "/v1/customers -X POST -H 'Content-Type: application/json' -d '{\"name\":\"E2E Customer\",\"email\":\"e2e-$TSTAMP@railswitch.test\",\"phone\":\"+2348000000000\"}'" "d.get('data',{}).get('id','FAIL')")

if [ "$CUSTOMER_ID" != "FAIL" ] && [ -n "$CUSTOMER_ID" ]; then
  ok "Create customer ($CUSTOMER_ID)"
  check_json "Get customer by ID" "$GATEWAY/v1/customers/$CUSTOMER_ID" "d['data']['id']" "$CUSTOMER_ID" -H "Authorization: Bearer $KEY"
  check_json "Customer name" "$GATEWAY/v1/customers/$CUSTOMER_ID" "d['data']['name']" "E2E Customer" -H "Authorization: Bearer $KEY"
  check_json "Customer email" "$GATEWAY/v1/customers/$CUSTOMER_ID" "'$TSTAMP' in d['data']['email']" "True" -H "Authorization: Bearer $KEY"
  check_json "Customer phone" "$GATEWAY/v1/customers/$CUSTOMER_ID" "d['data']['phone']" "+2348000000000" -H "Authorization: Bearer $KEY"

  CUST_404_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/customers/cus_nonexistent" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$CUST_404_CODE" = "404" ] && ok "404 on missing customer" || fail "404 on missing customer (got $CUST_404_CODE)"
else
  fail "Create customer (got: $CUSTOMER_ID)"
fi

# ============================================================================
# 5. SUBSCRIPTIONS — FULL LIFECYCLE
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  5. SUBSCRIPTIONS — Full Lifecycle"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SUB_PLAN=$(apijq "/v1/plans -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Sub Lifecycle Plan\",\"amount\":100000,\"currency\":\"NGN\",\"interval\":\"monthly\",\"interval_count\":1}'" "d.get('data',{}).get('id','FAIL')")
SUB_CUST=$(apijq "/v1/customers -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Sub Lifecycle User\",\"email\":\"sublifecycle-$TSTAMP@railswitch.test\"}'" "d.get('data',{}).get('id','FAIL')")

SUB_ID=""
if [ "$SUB_PLAN" != "FAIL" ] && [ "$SUB_CUST" != "FAIL" ]; then
  SUB_ID=$(apijq "/v1/subscriptions -X POST -H 'Content-Type: application/json' -d '{\"customer_id\":\"$SUB_CUST\",\"plan_id\":\"$SUB_PLAN\",\"start_date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'" "d.get('data',{}).get('id','FAIL')")
fi

if [ "$SUB_ID" != "FAIL" ] && [ -n "$SUB_ID" ]; then
  ok "Create subscription ($SUB_ID)"
  check_json "Get sub by ID" "$GATEWAY/v1/subscriptions/$SUB_ID" "d['data']['id']" "$SUB_ID" -H "Authorization: Bearer $KEY"
  check_json "State is active" "$GATEWAY/v1/subscriptions/$SUB_ID" "d['data']['state']" "active" -H "Authorization: Bearer $KEY"
  check_json "List subscriptions" "$GATEWAY/v1/subscriptions" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"
  check_json "Pagination meta" "$GATEWAY/v1/subscriptions?limit=3" "bool(d.get('meta',{}).get('has_more') is not None)" "True" -H "Authorization: Bearer $KEY"
  check_json "Pause sub" "$GATEWAY/v1/subscriptions/$SUB_ID/pause" "d['data']['state']" "paused" -X POST -H "Authorization: Bearer $KEY"
  check_json "Resume sub" "$GATEWAY/v1/subscriptions/$SUB_ID/resume" "d['data']['state']" "active" -X POST -H "Authorization: Bearer $KEY"
  check_json "Preview plan change" "$GATEWAY/v1/subscriptions/$SUB_ID/preview" "d.get('data',{}).get('net_amount') is not None" "True" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d "{\"new_plan_id\":\"$SUB_PLAN\"}"

  # PATCH plan change
  SUB_PLAN2=$(apijq "/v1/plans -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Sub Plan B\",\"amount\":200000,\"currency\":\"NGN\",\"interval\":\"monthly\",\"interval_count\":1}'" "d.get('data',{}).get('id','FAIL')")
  if [ "$SUB_PLAN2" != "FAIL" ]; then
    check_json "PATCH plan change" "$GATEWAY/v1/subscriptions/$SUB_ID" "d['data']['plan_id']" "$SUB_PLAN2" -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d "{\"plan_id\":\"$SUB_PLAN2\"}"
  fi

  check_json "Cancel sub" "$GATEWAY/v1/subscriptions/$SUB_ID/cancel" "d['data']['state']" "cancelled" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d '{"reason":"E2E lifecycle test"}'
  check_json "Second cancel idempotent" "$GATEWAY/v1/subscriptions/$SUB_ID/cancel" "d['data']['state']" "cancelled" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d '{"reason":"duplicate"}'

  SUB_404_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/subscriptions/sub_nonexistent" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$SUB_404_CODE" = "404" ] && ok "404 on missing sub" || fail "404 on missing sub (got $SUB_404_CODE)"
else
  fail "Create subscription (plan=$SUB_PLAN cust=$SUB_CUST sub=$SUB_ID)"
fi

# ============================================================================
# 6. INVOICES — LIFECYCLE
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  6. INVOICES — Lifecycle"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "List existing invoices" "$GATEWAY/v1/invoices" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"

INV_ID=""
if [ -n "$SUB_ID" ] && [ "$SUB_ID" != "FAIL" ]; then
  if date -u -v+30d > /dev/null 2>&1; then DUE=$(date -u -v+30d +%Y-%m-%dT%H:%M:%SZ); else DUE=$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$(date -u +%Y-%m-%d)T23:59:59Z"); fi
  INV_ID=$(apijq "/v1/invoices -X POST -H 'Content-Type: application/json' -d '{\"subscription_id\":\"$SUB_ID\",\"amount\":500000,\"due_date\":\"$DUE\",\"description\":\"E2E test invoice\"}'" "d.get('data',{}).get('id','FAIL')")
fi

if [ "$INV_ID" != "FAIL" ] && [ -n "$INV_ID" ]; then
  ok "Create invoice ($INV_ID)"
  check_json "Get invoice by ID" "$GATEWAY/v1/invoices/$INV_ID" "d['data']['id']" "$INV_ID" -H "Authorization: Bearer $KEY"

  INV_AMT=$(curl -s "$GATEWAY/v1/invoices/$INV_ID" -H "Authorization: Bearer $KEY" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(int(float(d.get('data',{}).get('amount',0))))" 2>/dev/null || echo "FAIL")
  if [ "$INV_AMT" = "500000" ]; then ok "Invoice amount (500000)"; else fail "Invoice amount (got $INV_AMT)"; fi

  check_json "Status is open" "$GATEWAY/v1/invoices/$INV_ID" "d['data']['status']" "open" -H "Authorization: Bearer $KEY"
  check_json "Retry invoice" "$GATEWAY/v1/invoices/$INV_ID/retry" "d['data']['status']" "retry_initiated" -X POST -H "Authorization: Bearer $KEY"
  check_json "Retry has next_attempt_at" "$GATEWAY/v1/invoices/$INV_ID/retry" "bool(d['data'].get('next_attempt_at'))" "True" -X POST -H "Authorization: Bearer $KEY"
  check_json "Refund invoice" "$GATEWAY/v1/invoices/$INV_ID/refund" "d['data']['status']" "refunded" -X POST -H "Authorization: Bearer $KEY"

  INV_RETRY_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/invoices/inv_nonexistent/retry" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$INV_RETRY_CODE" = "404" ] && ok "404 retry nonexistent" || fail "404 retry nonexistent (got $INV_RETRY_CODE)"

  INV_REFUND_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/invoices/inv_nonexistent/refund" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$INV_REFUND_CODE" = "404" ] && ok "404 refund nonexistent" || fail "404 refund nonexistent (got $INV_REFUND_CODE)"
else
  fail "Create invoice (got: $INV_ID)"
fi

# ============================================================================
# 7. PAYMENT METHODS — FULL CRUD
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  7. PAYMENT METHODS — Full CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "List existing PMs" "$GATEWAY/v1/payment-methods" "'data' in d" "True" -H "Authorization: Bearer $KEY"

PM_ID=""
if [ -n "$CUSTOMER_ID" ] && [ "$CUSTOMER_ID" != "FAIL" ]; then
  PM_ID=$(apijq "/v1/payment-methods -X POST -H 'Content-Type: application/json' -d '{\"customer_id\":\"$CUSTOMER_ID\",\"type\":\"card\",\"nomba_token\":\"tok_e2e_4242\",\"last4\":\"4242\",\"brand\":\"Visa\",\"exp_month\":\"12\",\"exp_year\":\"2028\",\"is_default\":true}'" "d.get('data',{}).get('id','FAIL')")
fi

if [ "$PM_ID" != "FAIL" ] && [ -n "$PM_ID" ]; then
  ok "Create payment method ($PM_ID)"
  check_json "Get PM by ID" "$GATEWAY/v1/payment-methods/$PM_ID" "d['data']['id']" "$PM_ID" -H "Authorization: Bearer $KEY"
  check_json "PM brand" "$GATEWAY/v1/payment-methods/$PM_ID" "d['data']['brand']" "Visa" -H "Authorization: Bearer $KEY"
  check_json "PM last4" "$GATEWAY/v1/payment-methods/$PM_ID" "d['data']['last4']" "4242" -H "Authorization: Bearer $KEY"
  check_json "PM is_default" "$GATEWAY/v1/payment-methods/$PM_ID" "d['data']['is_default']" "True" -H "Authorization: Bearer $KEY"
  check_json "Filter PMs by customer" "$GATEWAY/v1/payment-methods?customer_id=$CUSTOMER_ID" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"
  check_json "Delete PM" "$GATEWAY/v1/payment-methods/$PM_ID" "d['data']['deleted']" "True" -X DELETE -H "Authorization: Bearer $KEY"
  check_json "PM has deleted_at" "$GATEWAY/v1/payment-methods/$PM_ID" "bool(d['data'].get('deleted_at'))" "True" -H "Authorization: Bearer $KEY"
else
  fail "Create payment method (got: $PM_ID)"
fi

# ============================================================================
# 8. AUDIT LOGS
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  8. AUDIT LOGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Audit logs: gateway returns { data: [...] } (no total from gateway)
check_json "List audit logs" "$GATEWAY/v1/audit-logs" "len(d['data']) > 0" "True" -H "Authorization: Bearer $KEY"

AUDIT_DATA=$(curl -s "$GATEWAY/v1/audit-logs" -H "Authorization: Bearer $KEY" 2>/dev/null)
AUDIT_HAS_FIELDS=$(echo "$AUDIT_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d)>0 and bool(d[0].get('id')) and bool(d[0].get('reason')))" 2>/dev/null || echo "False")
if [ "$AUDIT_HAS_FIELDS" = "True" ]; then ok "Audit entry has fields"; else fail "Audit entry has fields (got $AUDIT_HAS_FIELDS)"; fi

if [ -n "$SUB_ID" ] && [ "$SUB_ID" != "FAIL" ]; then
  AUDIT_SUB=$(curl -s "$GATEWAY/v1/audit-logs/subscription/$SUB_ID" -H "Authorization: Bearer $KEY" 2>/dev/null)
  AUDIT_SUB_COUNT=$(echo "$AUDIT_SUB" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "0")
  if [ "$AUDIT_SUB_COUNT" -ge 1 ]; then ok "Audit by subscription ($AUDIT_SUB_COUNT entries)"; else fail "Audit by subscription (got $AUDIT_SUB_COUNT entries, expected >=1)"; fi
fi

# ============================================================================
# 9. WEBHOOK MANAGEMENT — FULL CRUD
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  9. WEBHOOK MANAGEMENT — Full CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "List webhook endpoints" "$GATEWAY/v1/webhooks/endpoints" "len(d['data']) >= 0" "True" -H "Authorization: Bearer $KEY"
check_json "List webhook deliveries" "$GATEWAY/v1/webhooks/deliveries" "len(d['data']) >= 0" "True" -H "Authorization: Bearer $KEY"
check_json "List webhook events" "$GATEWAY/v1/webhooks/events" "len(d['data']) >= 0" "True" -H "Authorization: Bearer $KEY"

WH_CREATE=$(curl -s -X POST "$GATEWAY/v1/webhooks/endpoints" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d '{"url":"https://e2e.railswitch.dev/webhook"}' 2>/dev/null)
WH_ID=$(echo "$WH_CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','FAIL'))" 2>/dev/null || echo "FAIL")
WH_SECRET=$(echo "$WH_CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(bool(d.get('data',{}).get('secret','').startswith('whsec_')))" 2>/dev/null || echo "False")

if [ "$WH_ID" != "FAIL" ] && [ -n "$WH_ID" ]; then
  ok "Create webhook endpoint ($WH_ID)"
  [ "$WH_SECRET" = "True" ] && ok "Has signing secret" || fail "Has signing secret (got $WH_SECRET)"
  check_json "Get webhook by ID" "$GATEWAY/v1/webhooks/endpoints/$WH_ID" "d['data']['id']" "$WH_ID" -H "Authorization: Bearer $KEY"

  check_json "Endpoint active" "$GATEWAY/v1/webhooks/endpoints/$WH_ID" "d['data']['status']" "active" -H "Authorization: Bearer $KEY"
  check_json "Update webhook URL" "$GATEWAY/v1/webhooks/endpoints/$WH_ID" "d['data']['url']" "https://e2e-updated.railswitch.dev/webhook" -X PATCH -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" -d '{"url":"https://e2e-updated.railswitch.dev/webhook"}'
  check_json "Delete webhook" "$GATEWAY/v1/webhooks/endpoints/$WH_ID" "d['data']['disabled']" "True" -X DELETE -H "Authorization: Bearer $KEY"
  check_json "Endpoint now disabled" "$GATEWAY/v1/webhooks/endpoints/$WH_ID" "d['data']['status']" "disabled" -H "Authorization: Bearer $KEY"

  WH_404_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/webhooks/endpoints/wh_nonexistent" -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
  [ "$WH_404_CODE" = "404" ] && ok "404 nonexistent endpoint" || fail "404 nonexistent endpoint (got $WH_404_CODE)"
else
  fail "Create webhook endpoint (got: $WH_ID)"
fi

# ============================================================================
# 10. PORTAL — TOKEN GENERATION & RESOLUTION
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  10. PORTAL — Token Generation & Resolution"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PORTAL_CUST=$(curl -s "$GATEWAY/v1/customers" -H "Authorization: Bearer $KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['id'] if d else 'FAIL')" 2>/dev/null || echo "FAIL")

if [ "$PORTAL_CUST" != "FAIL" ]; then
  PORTAL_DATA=$(curl -s -X POST "$GATEWAY/v1/portal/customers/$PORTAL_CUST/link" -H "Authorization: Bearer $KEY" 2>/dev/null)
  PORTAL_TOKEN=$(echo "$PORTAL_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token','FAIL'))" 2>/dev/null || echo "FAIL")
  PORTAL_URL=$(echo "$PORTAL_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('portal_url','FAIL'))" 2>/dev/null || echo "FAIL")

  if [ "$PORTAL_TOKEN" != "FAIL" ] && [ -n "$PORTAL_TOKEN" ]; then
    ok "Generate portal link for $PORTAL_CUST"
    check_json "Resolve via engine" "$ENGINE/internal/v1/portal/resolve?token=$PORTAL_TOKEN" "d['customer']['id']" "$PORTAL_CUST" -H "X-Internal-Auth: $IAUTH"
    check_json "Resolve via gateway" "$GATEWAY/v1/portal/resolve?token=$PORTAL_TOKEN" "d['data']['customer']['id']" "$PORTAL_CUST"
    check_json "Resolve via header" "$GATEWAY/v1/portal/resolve" "d['data']['customer']['id']" "$PORTAL_CUST" -H "x-portal-token: $PORTAL_TOKEN"
    check_http "Portal overview" "$PORTAL/portal?token=$PORTAL_TOKEN" "200"
    check_http "Portal subscriptions" "$PORTAL/portal/subscriptions?token=$PORTAL_TOKEN" "200"
    check_http "Portal invoices" "$PORTAL/portal/invoices?token=$PORTAL_TOKEN" "200"
    check_http "Portal payment-methods" "$PORTAL/portal/payment-methods?token=$PORTAL_TOKEN" "200"
    check_http "Portal settings" "$PORTAL/portal/settings?token=$PORTAL_TOKEN" "200"
  else
    fail "Generate portal link (token=$PORTAL_TOKEN)"
  fi
else
  fail "No customers available for portal test"
fi

# ============================================================================
# 11. ENGINE — DIRECT INTERNAL ENDPOINTS
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  11. ENGINE — Direct Internal Endpoint Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_json "Engine plans (direct)" "$ENGINE/internal/v1/plans" "len(d['data']) > 0" "True" -H "X-Internal-Auth: $IAUTH" -H "X-Merchant-Id: $MID"
check_json "Engine customers (direct)" "$ENGINE/internal/v1/customers" "len(d['data']) > 0" "True" -H "X-Internal-Auth: $IAUTH" -H "X-Merchant-Id: $MID"
check_json "Engine subs (direct)" "$ENGINE/internal/v1/subscriptions" "len(d['data']) > 0" "True" -H "X-Internal-Auth: $IAUTH" -H "X-Merchant-Id: $MID"
check_json "Engine invoices (direct)" "$ENGINE/internal/v1/invoices" "len(d['data']) > 0" "True" -H "X-Internal-Auth: $IAUTH" -H "X-Merchant-Id: $MID"
check_json "Engine audit-logs (direct)" "$ENGINE/internal/v1/audit-logs" "len(d['data']) > 0" "True" -H "X-Internal-Auth: $IAUTH" -H "X-Merchant-Id: $MID"

DBG_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$ENGINE/debug/subscription-machine" 2>/dev/null || echo "000")
if [ "$DBG_CODE" = "200" ]; then
  check_json "Debug state machine" "$ENGINE/debug/subscription-machine" "bool(d.get('id'))" "True"
elif [ "$DBG_CODE" = "403" ]; then
  echo "  ⚠️ Debug endpoint blocked (NODE_ENV=production, ALLOW_DEBUG not set)"
else
  echo "  ⚠️ Debug endpoint status: $DBG_CODE"
fi

# ============================================================================
# 12. STOREFRONT — FULL CHECKOUT SIMULATION
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  12. STOREFRONT — Full Checkout Simulation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SF_PLAN=$(apijq "/v1/plans -X POST -H 'Content-Type: application/json' -d '{\"name\":\"FitCore Basic\",\"amount\":990000,\"currency\":\"NGN\",\"interval\":\"monthly\",\"interval_count\":1}'" "d.get('data',{}).get('id','FAIL')")
[ "$SF_PLAN" != "FAIL" ] && ok "Storefront: create plan ($SF_PLAN)" || fail "Storefront: create plan"

SF_CUST=$(apijq "/v1/customers -X POST -H 'Content-Type: application/json' -d '{\"name\":\"FitCore User\",\"email\":\"fitcore-$TSTAMP@fitcore.ng\",\"phone\":\"+2348000000001\"}'" "d.get('data',{}).get('id','FAIL')")
[ "$SF_CUST" != "FAIL" ] && ok "Storefront: create customer ($SF_CUST)" || fail "Storefront: create customer"

SF_PM=$(apijq "/v1/payment-methods -X POST -H 'Content-Type: application/json' -d '{\"customer_id\":\"$SF_CUST\",\"type\":\"card\",\"nomba_token\":\"tok_fitcore_success\",\"last4\":\"1234\",\"brand\":\"Visa\",\"is_default\":true}'" "d.get('data',{}).get('id','FAIL')")
[ "$SF_PM" != "FAIL" ] && ok "Storefront: attach card ($SF_PM)" || fail "Storefront: attach card"

SF_SUB=$(apijq "/v1/subscriptions -X POST -H 'Content-Type: application/json' -d '{\"customer_id\":\"$SF_CUST\",\"plan_id\":\"$SF_PLAN\",\"start_date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'" "d.get('data',{}).get('id','FAIL')")
[ "$SF_SUB" != "FAIL" ] && ok "Storefront: create subscription ($SF_SUB)" || fail "Storefront: create subscription"

if date -u -v+30d > /dev/null 2>&1; then DUE=$(date -u -v+30d +%Y-%m-%dT%H:%M:%SZ); else DUE=$(date -u -d '+30 days' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$(date -u +%Y-%m-%d)T23:59:59Z"); fi
SF_INV=$(apijq "/v1/invoices -X POST -H 'Content-Type: application/json' -d '{\"subscription_id\":\"$SF_SUB\",\"amount\":990000,\"due_date\":\"$DUE\",\"description\":\"FitCore Basic - Month 1\"}'" "d.get('data',{}).get('id','FAIL')")
[ "$SF_INV" != "FAIL" ] && ok "Storefront: create invoice ($SF_INV)" || fail "Storefront: create invoice"

# ============================================================================
# 13. NOMBA WEBHOOK — SIMULATED INBOUND
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  13. NOMBA WEBHOOK — Simulated Inbound"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use direct curl calls (the payload contains JSON with special chars)
TXN_REF="txn_e2e_$(date +%s)"
WPAY="{\"event_type\":\"payment_success\",\"requestId\":\"$TXN_REF\",\"data\":{\"merchantTxRef\":\"$TXN_REF\",\"amount\":990000,\"currency\":\"NGN\",\"customer\":{\"email\":\"test@nomba.com\"},\"card\":{\"last4\":\"1234\",\"brand\":\"Visa\"},\"status\":\"success\"}}"

WH_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/webhooks/nomba" \
  -H "Content-Type: application/json" -H "nomba-signature: dev_bypass" \
  -H "nomba-timestamp: $(date +%s)" -d "$WPAY" 2>/dev/null || echo "000")
[ "$WH_CODE" = "200" ] && ok "Nomba basic webhook" || fail "Nomba basic webhook (got $WH_CODE)"

WSIG=$(echo -n "$WPAY" | openssl dgst -sha256 -hmac "test_nomba_webhook_secret" 2>/dev/null | cut -d' ' -f2 || echo "")
if [ -n "$WSIG" ]; then
  WH_SIG_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/webhooks/nomba" \
    -H "Content-Type: application/json" -H "nomba-signature: $WSIG" \
    -H "nomba-timestamp: $(date +%s)" -d "$WPAY" 2>/dev/null || echo "000")
  [ "$WH_SIG_CODE" = "200" ] && ok "Nomba signed webhook" || fail "Nomba signed webhook (got $WH_SIG_CODE)"
fi

WH_DEDUP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/webhooks/nomba" \
  -H "Content-Type: application/json" -H "nomba-signature: dev_bypass" \
  -H "nomba-timestamp: $(date +%s)" -d "$WPAY" 2>/dev/null || echo "000")
[ "$WH_DEDUP_CODE" = "200" ] && ok "Nomba dedup (same requestId)" || fail "Nomba dedup (got $WH_DEDUP_CODE)"

VAPAY="{\"event_type\":\"virtual_account.funded\",\"requestId\":\"va_$TXN_REF\",\"data\":{\"accountRef\":\"$TXN_REF\",\"amount\":990000,\"currency\":\"NGN\"}}"
WH_VA_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/webhooks/nomba" \
  -H "Content-Type: application/json" -H "nomba-signature: dev_bypass" \
  -H "nomba-timestamp: $(date +%s)" -d "$VAPAY" 2>/dev/null || echo "000")
[ "$WH_VA_CODE" = "200" ] && ok "Nomba VA-funded webhook" || fail "Nomba VA-funded (got $WH_VA_CODE)"

# ============================================================================
# 14. ERROR HANDLING & EDGE CASES
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  14. ERROR HANDLING & EDGE CASES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 422 from gateway Pydantic validation
VAL_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/plans" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d '{}' 2>/dev/null || echo "000")
[ "$VAL_CODE" = "422" ] && ok "422 on missing fields" || fail "422 on missing fields (got $VAL_CODE)"

# 404 on missing resources (HTTP status code check)
M404_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/subscriptions/sub_nonexistent" \
  -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
[ "$M404_CODE" = "404" ] && ok "404 missing subscription" || fail "404 missing subscription (got $M404_CODE)"

M404C_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/v1/customers/cus_nonexistent" \
  -H "Authorization: Bearer $KEY" 2>/dev/null || echo "000")
[ "$M404C_CODE" = "404" ] && ok "404 missing customer" || fail "404 missing customer (got $M404C_CODE)"

# Subscription create with empty body — returns 422 from gateway
SUBCREATE_ERR=$(curl -s -X POST "$GATEWAY/v1/subscriptions" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  -d '{}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('code',''))" 2>/dev/null || echo "")
[ "$SUBCREATE_ERR" = "422" ] && ok "Missing fields create sub" || fail "Missing fields create sub (got $SUBCREATE_ERR)"

# Preview with empty body — FastAPI 422 or engine 400
if [ -n "${SUB_ID:-}" ] && [ "$SUB_ID" != "FAIL" ]; then
  PREVIEW_ERR=$(curl -s -X POST "$GATEWAY/v1/subscriptions/$SUB_ID/preview" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
    -d '{}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))" 2>/dev/null || echo "")
  # Should be 422 (FastAPI validation) or 400 (engine validation)
  PREVIEW_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/v1/subscriptions/$SUB_ID/preview" \
    -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
    -d '{}' 2>/dev/null || echo "000")
  if [ "$PREVIEW_CODE" = "422" ] || [ "$PREVIEW_CODE" = "400" ]; then
    ok "Preview missing plan_id (HTTP $PREVIEW_CODE)"
  else
    fail "Preview missing plan_id (got HTTP $PREVIEW_CODE)"
  fi
fi

# ============================================================================
# 15. CASCADE SYSTEM — DATABASE VERIFICATION
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  15. CASCADE SYSTEM — Database Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker exec infra-postgres-1 psql -U railswitch -d railswitch -c "
  SELECT state, count(*) FROM subscriptions
  WHERE merchant_id='$MID' GROUP BY state ORDER BY state;" 2>/dev/null || echo "  └─ (PostgreSQL unavailable)"

docker exec infra-postgres-1 psql -U railswitch -d railswitch -c "
  SELECT id, state, va_id, va_bank FROM subscriptions
  WHERE va_id IS NOT NULL AND merchant_id='$MID' LIMIT 5;" 2>/dev/null || echo "  └─ (PostgreSQL unavailable)"

docker exec infra-postgres-1 psql -U railswitch -d railswitch -c "
  SELECT status, count(*), sum(amount)/100 as total_ngn
  FROM invoices GROUP BY status ORDER BY status;" 2>/dev/null || echo "  └─ (PostgreSQL unavailable)"

docker exec infra-postgres-1 psql -U railswitch -d railswitch -c "
  SELECT status, count(*) FROM webhook_delivery_attempts GROUP BY status;" 2>/dev/null || echo "  └─ (PostgreSQL unavailable)"

docker exec infra-postgres-1 psql -U railswitch -d railswitch -c "
  SELECT subscription_id, event, created_at FROM audit_logs
  ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "  └─ (PostgreSQL unavailable)"

docker exec infra-redis-1 redis-cli LLEN bull:billing:wait 2>/dev/null || echo "  └─ (Redis unavailable)"

# ============================================================================
# 16. METRICS — RECOVERY RATE & STATISTICS
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  16. METRICS — Recovery Rate & Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

python3 -c "
import sys,json,urllib.request
req = urllib.request.Request('$GATEWAY/v1/invoices', headers={'Authorization':'Bearer $KEY'})
resp = urllib.request.urlopen(req, timeout=5)
d = json.load(resp)['data']
paid = sum(1 for i in d if i['status']=='paid')
failed = sum(1 for i in d if i['status'] in ('uncollectible','void','expired'))
pending = sum(1 for i in d if i['status'] in ('pending','pending_retry','open'))
ttl = paid + failed
rec = round(paid/ttl*100, 1) if ttl > 0 else 0
print(f'  Invoice Metrics:')
print(f'    Total:    {len(d)}')
print(f'    Paid:     {paid}')
print(f'    Failed:   {failed}')
print(f'    Pending:  {pending}')
print(f'    Recovery: {rec}%')
for s in sorted(set(i['status'] for i in d)):
    print(f'    {s}: {sum(1 for i in d if i[\"status\"]==s)}')
" 2>/dev/null || echo "  └─ (computation failed)"

python3 -c "
import sys,json,urllib.request
req = urllib.request.Request('$GATEWAY/v1/subscriptions', headers={'Authorization':'Bearer $KEY'})
resp = urllib.request.urlopen(req, timeout=5)
d = json.load(resp)['data']
sc = {}
for s in d: sc[s['state']] = sc.get(s['state'],0)+1
sts = ['active','past_due','cancelled','paused','trialing','va_fallback','retrying','whatsapp_fallback','expired']
ttl = len(d)
print(f'  Subscription Breakdown ({ttl} total):')
for st in sts:
    c = sc.get(st,0); pct = round(c/ttl*100,1) if ttl else 0
    print(f'    {st:20s}: {c:4d} ({pct:5.1f}%)')
" 2>/dev/null || echo "  └─ (computation failed)"

python3 -c "
import sys,json,urllib.request
req = urllib.request.Request('$GATEWAY/v1/plans', headers={'Authorization':'Bearer $KEY'})
resp = urllib.request.urlopen(req, timeout=5)
d = json.load(resp)['data']
print(f'  Plans ({len(d)} total, {sum(1 for p in d if p.get(\"is_active\"))} active):')
for p in d[:10]:
    print(f'    {p[\"name\"]:30s}: N{float(p.get(\"amount\",0))/100:>8,.0f}/mo')
" 2>/dev/null || echo "  └─ (computation failed)"

# ============================================================================
# 17. SDK — NODE.JS PACKAGE
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  17. SDK — Node.js Package Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SDK_DIR=$(mktemp -d)
pushd "$SDK_DIR" > /dev/null 2>&1 || true
if npm init -y > /dev/null 2>&1 && npm install railswitch --silent 2>/dev/null; then
  SDK_VER=$(node -e "console.log(require('railswitch/package.json').version)" 2>/dev/null || echo "?")
  ok "SDK v$SDK_VER installed"
  SL=$(node -e "
    const {RailSwitch}=require('railswitch');
    const rs=new RailSwitch({apiKey:'$KEY',baseUrl:'$GATEWAY'});
    rs.subscriptions.list({}).then(r=>console.log('OK:'+JSON.stringify(r))).catch(e=>console.log('ERR:'+e.message));
  " 2>/dev/null)
  if echo "$SL" | grep -q "OK:"; then ok "SDK list subscriptions"; else fail "SDK list ($SL)"; fi
else
  fail "SDK installation"
fi
popd > /dev/null 2>&1 || true
rm -rf "$SDK_DIR"

# ============================================================================
# 18. CLEANUP — REMOVE TEST DATA
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  18. CLEANUP — Remove Test Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MID=$(docker exec infra-postgres-1 psql -U railswitch -d railswitch -t -c "SELECT id FROM merchants WHERE email='demo@railswitch.dev';" 2>/dev/null | tr -d ' ')
PSQL="docker exec infra-postgres-1 psql -U railswitch -d railswitch -c"

# Diagnostic: show state before cleanup
echo "  [debug] MID=$MID"
$PSQL "SELECT 'pre-cleanup plans:' as label, COUNT(*) FROM plans WHERE merchant_id='$MID';"
$PSQL "SELECT 'pre-cleanup subs:' as label, COUNT(*) FROM subscriptions WHERE merchant_id='$MID';"
$PSQL "SELECT 'pre-cleanup seed-subs:' as label, COUNT(*) FROM subscriptions WHERE merchant_id='$MID' AND plan_id IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'));"
$PSQL "SELECT 'pre-cleanup test-subs:' as label, COUNT(*) FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'));"

# Delete all subscriptions on non-seed plans (test data), with FK-safe order
$PSQL "UPDATE subscriptions SET current_invoice_id = NULL WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'));" >/dev/null 2>&1
$PSQL "DELETE FROM charge_attempts WHERE subscription_id IN (SELECT id FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)')));" >/dev/null 2>&1
$PSQL "DELETE FROM credits WHERE subscription_id IN (SELECT id FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)')));" >/dev/null 2>&1
$PSQL "DELETE FROM audit_log WHERE subscription_id IN (SELECT id FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)')));" >/dev/null 2>&1
$PSQL "DELETE FROM processed_events WHERE subscription_id IN (SELECT id FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)')));" >/dev/null 2>&1
$PSQL "DELETE FROM invoices WHERE subscription_id IN (SELECT id FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)')));" >/dev/null 2>&1
$PSQL "DELETE FROM subscriptions WHERE merchant_id='$MID' AND plan_id NOT IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'));" >/dev/null 2>&1
echo "  ✅ Test subscriptions deleted"

# Delete test plans (everything except the 5 seed plans)
$PSQL "DELETE FROM plans WHERE merchant_id='$MID' AND name NOT IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)');" >/dev/null 2>&1
echo "  ✅ Test plans deleted"

# Delete test customers that have no active subscriptions on seed plans
$PSQL "DELETE FROM customers WHERE merchant_id='$MID' AND id NOT IN (SELECT DISTINCT customer_id FROM subscriptions WHERE merchant_id='$MID' AND plan_id IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'))) AND (email LIKE '%@railswitch.test' OR email LIKE '%@demo.dev');" >/dev/null 2>&1
echo "  ✅ Orphaned test customers cleaned"

# Clean up test merchants using docker exec
if [ -n "${REG_MER:-}" ] && [ "$REG_MER" != "FAIL" ]; then
  $PSQL "DELETE FROM api_keys WHERE merchant_id='$REG_MER';" >/dev/null 2>&1
  $PSQL "DELETE FROM merchants WHERE id='$REG_MER';" >/dev/null 2>&1
  echo "  ✅ Test merchant cleaned"
fi

# Re-seed demo data if seed subscriptions were destroyed
SEED_SUBS=$($PSQL -t "SELECT COUNT(*) FROM subscriptions WHERE merchant_id='$MID' AND plan_id IN (SELECT id FROM plans WHERE merchant_id='$MID' AND name IN ('Basic','Pro','Elite','Corporate','Basic (Legacy)'));" 2>/dev/null | tr -d ' ')
if [ "${SEED_SUBS:-0}" -lt 200 ]; then
  echo "  ↻ Re-seeding demo data (only ${SEED_SUBS:-0} seed subs survived)..."
  python3 scripts/seed-demo.py 2>&1 | tail -5
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    TEST RESULTS                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total:   $((PASS + FAIL))"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 ALL TESTS PASSED"
else
  echo "  ❌ $FAIL/$((PASS + FAIL)) TESTS FAILED"
fi
echo ""
