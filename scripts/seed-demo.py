"""
RailSwitch Demo Seeder — FitCore Nigeria

Creates a realistic demo environment:
  - 275 subscriptions (255 active, 10 cancelled, 5 paused, 5 trialing)
  - 5 cascade-state subs showcasing payment recovery
  - ~97% recovery rate, ~3.6% churn
  - ₦10.3M MRR / ₦123M ARR
  - 6 months of realistic invoice history
"""
import subprocess, json, random, datetime, sys

H = "http://localhost:8000"
MID = ""
K = ""

def api(method, path, body=None):
    args = ["curl", "-s", "-X", method, f"{H}{path}", "-H", "Content-Type: application/json", "-H", f"Authorization: Bearer {K}"]
    if body: args += ["-d", json.dumps(body)]
    result = subprocess.run(args, capture_output=True, text=True)
    try: return json.loads(result.stdout)
    except: print(f"API ERROR: {result.stdout[:200]}", file=sys.stderr); return {}

def psql(sql):
    return subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-c",sql], capture_output=True, text=True)

def psql_t(sql):
    r = subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-t","-c",sql], capture_output=True, text=True)
    return r.stdout.strip()

# ── Register or get existing demo account ──
reg = api("POST", "/v1/auth/register", {"name":"FitCore Nigeria","email":"demo@railswitch.dev","password":"demo123456","company":"FitCore Nigeria"})
if reg.get("data"):
    K = reg["data"]["api_key"]
    MID = reg["data"]["merchant"]["id"]
    print(f"Registered FitCore: {MID}")
else:
    MID = psql_t("SELECT id FROM merchants WHERE email='demo@railswitch.dev';")
    K = psql_t(f"SELECT 'sk_test_' || merchant_id || '__' || substr(key_hash,1,20) FROM api_keys WHERE merchant_id='{MID}' LIMIT 1;")
    print(f"Using existing: {MID}")

# ── Clean ──
print("Cleaning...")
psql(f"UPDATE subscriptions SET current_invoice_id = NULL WHERE merchant_id='{MID}';")
for t in ["charge_attempts","audit_log","credits","processed_events",
          "webhook_delivery_attempts","webhook_events","webhook_endpoints",
          "payment_methods","invoices","subscriptions","customers","plans"]:
    psql(f"DELETE FROM {t} WHERE merchant_id='{MID}' OR merchant_id IS NULL;")

# ══════════════════════════════════════════════════════════════════════════════
# PLANS
# ══════════════════════════════════════════════════════════════════════════════
plans = {}
plan_data = [
    ("Basic",     "Perfect for individuals starting their fitness journey.",  990000),
    ("Pro",       "For dedicated members who want full access and training.", 2990000),
    ("Elite",     "Premium experience with personal training and recovery.",  7990000),
    ("Corporate", "Complete wellness solution for your entire team.",         24900000),
]
for name, desc, amount in plan_data:
    r = api("POST", "/v1/plans", {"name":name,"description":desc,"amount":amount,"currency":"NGN","interval":"monthly","interval_count":1})
    plans[name.lower()] = r["data"]["id"]
    print(f"  {name}: {plans[name.lower()]} (₦{amount/100:,.0f}/mo)")

# Legacy (archived, not shown on storefront)
r = api("POST", "/v1/plans", {"name":"Basic (Legacy)","description":"Grandfathered plan.","amount":490000,"currency":"NGN","interval":"monthly","interval_count":1})
psql(f"UPDATE plans SET is_active = false WHERE id = '{r['data']['id']}';")
plans["legacy"] = r["data"]["id"]

# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMERS — 280 diverse Nigerian names
# ══════════════════════════════════════════════════════════════════════════════
first_names = [
    "Adeola","Chinedu","Fatima","Emeka","Blessing","Tunde","Ngozi","Yusuf",
    "Grace","David","Ifeoma","Musa","Sarah","Obinna","Zainab","Kelechi",
    "Aisha","John","Adaobi","Oluwaseun","Chinaza","Ibrahim","Folake","Uche",
    "Hauwa","Seyi","Nneka","Tobi","Moji","Ebuka","Chiamaka","Yemi","Bimpe",
    "Bayo","Ronke","Sola","Lola","Femi","Dapo","Wale","Amara","Chuka","Efe",
    "Gbenga","Halima","Ifeanyi","Jumoke","Kola","Lara","Moses","Olga",
    "Chidinma","Temitope","Akin","Bola","Doris","Emmanuel","Funke","Gideon",
    "Helen","Ifeanyichukwu","Joseph","Kemi","Linda","Michael","Ngozika","Olumide",
    "Priscilla","Quadri","Rasheedat","Sade","Toyin","Udo","Victoria","Wunmi",
    "Xavier","Yinka","Zainab","Abel","Blessing","Cynthia","Daniel","Esther",
    "Frank","Gloria","Henry","Ife","James","Kunle","Lydia","Matthew",
    "Nneka","Ola","Patrick","Rita","Sunday","Titilayo","Uchenna","Vincent"
]
last_names = [
    "Ibrahim","Okonkwo","Bello","Nwosu","Adeyemi","Bakare","Eze","Mohammed",
    "Oluwole","Chukwu","Abdullahi","Johnson","Okafor","Usman","Madu","Bala",
    "Peters","Obi","Adebayo","Musa","Abubakar","Nwachukwu","Ogunleye","Akpan",
    "Ekong","Oladipo","Balogun","Ajayi","Lawal","Nwankwo","Ogunbanjo","Bankole",
    "Alabi","Suleiman","Danjuma","Okoro","Adesina","Onyeka","Taiwo","Kehinde",
    "Idris","Garba","Emenike","Olamide","Somto","Chibueze","Nnamdi","Oluwadare",
    "Titilayo","Abiola","Fashola","Amoo","Oyewole","Olaniyan","Akinwale","Oyedele"
]
used_names = set()
customers = []
for i in range(280):
    while True:
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        if name not in used_names: used_names.add(name); break
    email = f"user{i}@demo.dev"
    d = api("POST", "/v1/customers", {"name": name, "email": email})
    customers.append(d["data"]["id"])
    if (i+1) % 50 == 0: print(f"  {i+1}/280 customers")

# Backdate customers across 12 months
for cid in customers:
    days_ago = random.randint(5, 365)
    created = (datetime.datetime.now() - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
    psql(f"UPDATE customers SET created_at = '{created}' WHERE id = '{cid}';")
print("  Customers backdated across 12 months")

# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTIONS — 275 total
#
# 255 active (120 basic + 85 pro + 35 elite + 15 corporate)
#  10 cancelled
#   5 paused
#   5 trialing
#    = 275
# ══════════════════════════════════════════════════════════════════════════════
print("Creating subscriptions...")

# 255 active — plan distribution favorable to product (most on Basic/Pro)
active_dist = [("basic",120), ("pro",85), ("elite",35), ("corporate",15)]
cursor = 0
for plan_key, count in active_dist:
    for i in range(count):
        idx = cursor + i
        months_ago = random.randint(0, 8)
        start = (datetime.datetime.now() - datetime.timedelta(days=30*months_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
        api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": plans[plan_key], "start_date": start})
    cursor += count
print(f"  255 active subs created")

# 10 cancelled — realistic churn reasons
cancel_reasons = [
    "Switched to competitor","Budget constraints","No longer needed","Moving to new city",
    "Business closed","Relocating abroad","Found alternative","Too expensive",
    "Poor experience","Personal reasons"
]
for i, reason in enumerate(cancel_reasons):
    idx = cursor + i
    months_ago = random.randint(2, 10)
    start = (datetime.datetime.now() - datetime.timedelta(days=30*months_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["basic"], plans["pro"]]), "start_date": start})
    subs = api("GET", "/v1/subscriptions")["data"]
    sub = [s for s in subs if s["customer_id"] == customers[idx]]
    if sub: api("POST", f"/v1/subscriptions/{sub[0]['id']}/cancel", {"reason": reason})
cursor += 10
print(f"  10 cancelled subs created")

# 5 paused — customers taking a break
for i in range(5):
    idx = cursor + i
    months_ago = random.randint(1, 6)
    start = (datetime.datetime.now() - datetime.timedelta(days=30*months_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["pro"], plans["elite"]]), "start_date": start})
    subs = api("GET", "/v1/subscriptions")["data"]
    sub = [s for s in subs if s["customer_id"] == customers[idx]]
    if sub: api("POST", f"/v1/subscriptions/{sub[0]['id']}/pause", {})
cursor += 5
print(f"  5 paused subs created")

# 5 trialing — new prospects
for i in range(5):
    idx = cursor + i
    trial_end = (datetime.datetime.now() + datetime.timedelta(days=random.randint(2, 12))).strftime("%Y-%m-%dT%H:%M:%SZ")
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["basic"], plans["pro"], plans["elite"]]), "start_date": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"), "trial_end": trial_end})
cursor += 5
print(f"  5 trialing subs created")

# ══════════════════════════════════════════════════════════════════════════════
# CASCADE STATE SUBSCRIPTIONS — 5 subs showcasing payment recovery pipeline
#
# These are a tiny fraction (1.8%) of active subs — realistic for a healthy
# payment system where most failures are temporary and get resolved.
# ══════════════════════════════════════════════════════════════════════════════
print("Creating cascade-state subscriptions...")
CASCADE_CUSTOMERS = customers[cursor:cursor+5]
plan_amounts_cascade = {plans["basic"]: 990000, plans["pro"]: 2990000, plans["elite"]: 7990000, plans["corporate"]: 24900000}
CASCADE_CONFIGS = [
    # (state, plan_key, retry_count, last_failure_reason)
    ("retrying",          "basic",  2, "Card declined: insufficient funds"),
    ("retrying",          "pro",    1, "Card declined: do not honor"),
    ("va_fallback",       "pro",    5, "Card retry limit reached"),
    ("whatsapp_fallback", "elite",  5, "Virtual account expired"),
    ("past_due",          "basic",  5, "All recovery channels exhausted"),
]

for i, (state, plan_key, retry_count, last_failure) in enumerate(CASCADE_CONFIGS):
    sub_id = f"sub_cascade_{i+1:03d}"
    start = (datetime.datetime.now() - datetime.timedelta(days=random.randint(15, 60))).strftime("%Y-%m-%dT%H:%M:%SZ")
    period_start = (datetime.datetime.now() - datetime.timedelta(days=random.randint(1, 25))).strftime("%Y-%m-%dT%H:%M:%SZ")
    period_end = (datetime.datetime.now() + datetime.timedelta(days=random.randint(5, 25))).strftime("%Y-%m-%dT%H:%M:%SZ")
    va_id = f"va_{sub_id}" if state in ("va_fallback", "whatsapp_fallback", "past_due") else None
    va_expires = (datetime.datetime.now() + datetime.timedelta(days=random.randint(-2, 3))).strftime("%Y-%m-%dT%H:%M:%SZ") if va_id else None

    psql(f"""
        INSERT INTO subscriptions (id, merchant_id, customer_id, plan_id, state, version, retry_count, last_failure_reason, last_failure_retryable, va_id, va_expires_at, current_period_start, current_period_end, created_at, updated_at)
        VALUES ('{sub_id}', '{MID}', '{CASCADE_CUSTOMERS[i]}', '{plans[plan_key]}', '{state}', 1, {retry_count}, '{last_failure}', {'true' if state == 'retrying' else 'false'}, {'NULL' if not va_id else f"'{va_id}'"}, {'NULL' if not va_expires else f"'{va_expires}'"}, '{period_start}', '{period_end}', NOW() - INTERVAL '{random.randint(15,60)} days', NOW())
        ON CONFLICT DO NOTHING;
    """)

    # Failed invoice for this sub
    inv_id = f"inv_cascade_{i+1:03d}"
    amount = plan_amounts_cascade[plans[plan_key]]
    due_date = (datetime.datetime.now() - datetime.timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%dT%H:%M:%SZ")
    inv_status = "uncollectible" if state == "past_due" else "pending_retry"

    psql(f"""
        INSERT INTO invoices (id, subscription_id, merchant_id, amount, currency, status, due_date, created_at)
        VALUES ('{inv_id}', '{sub_id}', '{MID}', {amount}, 'NGN', '{inv_status}', '{due_date}', NOW() - INTERVAL '{random.randint(1,10)} days')
        ON CONFLICT DO NOTHING;
    """)
    psql(f"UPDATE subscriptions SET current_invoice_id = '{inv_id}' WHERE id = '{sub_id}';")

    # Charge attempts
    for attempt in range(retry_count):
        attempt_date = (datetime.datetime.now() - datetime.timedelta(days=random.randint(1, 8), hours=random.randint(0, 23))).strftime("%Y-%m-%dT%H:%M:%SZ")
        psql(f"""
            INSERT INTO charge_attempts (id, invoice_id, merchant_id, attempted_at, status, reason)
            VALUES ('ch_cascade_{i+1:03d}_{attempt+1}', '{inv_id}', '{MID}', '{attempt_date}', 'failed', '{last_failure}')
            ON CONFLICT DO NOTHING;
        """)

print(f"  5 cascade subs: 2 retrying, 1 va_fallback, 1 whatsapp_fallback, 1 past_due")

# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT METHODS — ~30% of customers have a card on file
# ══════════════════════════════════════════════════════════════════════════════
brands = ["visa","mastercard","verve"]
for i in random.sample(range(255), 80):
    api("POST", "/v1/payment-methods", {"customer_id": customers[i], "type":"card", "nomba_token":f"tok_demo_{i}", "last4":str(random.randint(1000,9999)), "brand":random.choice(brands), "is_default":True})
print("  Payment methods added (80 cards)")

# ══════════════════════════════════════════════════════════════════════════════
# INVOICE HISTORY — 6 months of realistic payment data
#
# 95% paid, 1.5% uncollectible, 3.5% pending_retry (being retried)
# Recovery rate = 95 / (95 + 1.5) = 98.4%
# ══════════════════════════════════════════════════════════════════════════════
print("Generating invoice history...")
subs = api("GET", "/v1/subscriptions")["data"]
plan_amounts = {plans["basic"]: 990000, plans["pro"]: 2990000, plans["elite"]: 7990000, plans["corporate"]: 24900000}

for sub in subs:
    if sub["state"] == "trialing": continue
    started = datetime.datetime.fromisoformat(sub["current_period_start"].replace("Z","+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    months_active = max(1, (now.year - started.year) * 12 + (now.month - started.month))
    amount = plan_amounts.get(sub["plan_id"], 990000)

    for m in range(months_active):
        due = (started + datetime.timedelta(days=30*m)).strftime("%Y-%m-%dT%H:%M:%SZ")
        paid = (started + datetime.timedelta(days=30*m+1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        inv_id = f"inv_{sub['id'][:8]}_{m}"

        # 95% paid, 1.5% uncollectible, 3.5% pending_retry
        r = random.random()
        if r < 0.95:
            inv_status = 'paid'; paid_at = f"'{paid}'"
        elif r < 0.965:
            inv_status = 'uncollectible'; paid_at = 'NULL'
        else:
            inv_status = 'pending_retry'; paid_at = 'NULL'

        psql(f"INSERT INTO invoices (id, subscription_id, merchant_id, amount, currency, status, due_date, paid_at, created_at) VALUES ('{inv_id}', '{sub['id']}', '{MID}', {amount}, 'NGN', '{inv_status}', '{due}', {paid_at}, '{due}') ON CONFLICT DO NOTHING;")

print("  Invoice history generated")

# ══════════════════════════════════════════════════════════════════════════════
# VERIFY
# ══════════════════════════════════════════════════════════════════════════════
subs = api("GET", "/v1/subscriptions")["data"]
custs = api("GET", "/v1/customers")["data"]
plans_list = api("GET", "/v1/plans")["data"]

st = {}
for s in subs: st[s["state"]] = st.get(s["state"],0) + 1
active = [s for s in subs if s["state"]=="active"]
plan_map = {p["id"]: int(p["amount"]) for p in plans_list}
mrr = sum(plan_map.get(s["plan_id"],0) for s in active)
plan_dist = {}
for s in active:
    pname = next((p["name"] for p in plans_list if p["id"]==s["plan_id"]), "?")
    plan_dist[pname] = plan_dist.get(pname,0) + 1

cascade_count = int(psql_t(f"SELECT COUNT(*) FROM subscriptions WHERE merchant_id='{MID}' AND state IN ('retrying','va_fallback','whatsapp_fallback','past_due');") or "0")

# Invoice stats
inv_stats = {}
for row in psql(f"SELECT status, COUNT(*) as c FROM invoices WHERE merchant_id='{MID}' GROUP BY status;").stdout.strip().split("\n"):
    if "|" in row:
        parts = [x.strip() for x in row.split("|") if x.strip()]
        if len(parts) == 2 and parts[0] != "status":
            try: inv_stats[parts[0]] = int(parts[1])
            except: pass

paid = inv_stats.get("paid", 0)
uncollectible = inv_stats.get("uncollectible", 0)
pending = inv_stats.get("pending_retry", 0)
recovery = round(paid / (paid + uncollectible) * 100, 1) if (paid + uncollectible) > 0 else 0
total_inv = paid + uncollectible + pending

print(f"\n{'═'*50}")
print(f"  FITCORE NIGERIA — DEMO ENVIRONMENT")
print(f"{'═'*50}")
print(f"  Merchant:        {MID}")
print(f"  Customers:       {len(custs)}")
print(f"  Plans:           {len(plans_list)} (4 active + 1 legacy)")
print(f"  Subscriptions:   {sum(st.values())} total")
print(f"    Active:        {st.get('active',0)} ({plan_dist})")
print(f"    Cancelled:     {st.get('cancelled',0)} ({round(st.get('cancelled',0)/sum(st.values())*100,1)}% churn)")
print(f"    Paused:        {st.get('paused',0)}")
print(f"    Trialing:      {st.get('trialing',0)}")
print(f"    Cascade:       {cascade_count} (retrying={st.get('retrying',0)}, va={st.get('va_fallback',0)}, whatsapp={st.get('whatsapp_fallback',0)}, past_due={st.get('past_due',0)})")
print(f"  Invoices:        {total_inv} total")
print(f"    Paid:          {paid} ({round(paid/total_inv*100,1)}%)")
print(f"    Uncollectible: {uncollectible} ({round(uncollectible/total_inv*100,1)}%)")
print(f"    Pending retry: {pending} ({round(pending/total_inv*100,1)}%)")
print(f"  Recovery Rate:   {recovery}%")
print(f"  MRR:             ₦{mrr/100:,.0f}")
print(f"  ARR:             ₦{mrr*12/100:,.0f}")
print(f"{'═'*50}")
print(f"  Login:   demo@railswitch.dev / demo123456")
print(f"  Dashboard: http://localhost:3000/dashboard")
print(f"  Storefront: http://localhost:3200")
print(f"{'═'*50}")
