"""
RailSwitch Demo Seeder — FitCore Nigeria
Creates a clean demo environment with proper plan names, backdated customers, and multi-month invoice history.
"""
import subprocess, json, random, datetime, sys

H = "http://localhost:8000"
MID = "mer_GxcWEznOTk"

K = "sk_test_mer_GxcWEznOTk__FTfhQ2_wRH563JIFwhQeczbqD9Y"
def api(method, path, body=None):
    args = ["curl", "-s", "-X", method, f"{H}{path}", "-H", "Content-Type: application/json", "-H", f"Authorization: Bearer {K}"]
    if body: args += ["-d", json.dumps(body)]
    result = subprocess.run(args, capture_output=True, text=True)
    try: return json.loads(result.stdout)
    except: print(f"API ERROR: {result.stdout[:200]}", file=sys.stderr); return {}

# ── Register or get existing demo account ──
reg = api("POST", "/v1/auth/register", {"name":"FitCore Nigeria","email":"demo@railswitch.dev","password":"demo123456","company":"FitCore Nigeria"})
if reg.get("data"):
    K = "sk_test_mer_GxcWEznOTk__FTfhQ2_wRH563JIFwhQeczbqD9Y"
    MID = reg["data"]["merchant"]["id"]
    print(f"Registered FitCore: {MID}")
else:
    # Get existing key from DB
    res = subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-t","-c",
        "SELECT id FROM merchants WHERE email='demo@railswitch.dev';"], capture_output=True, text=True)
    MID = res.stdout.strip()
    # Get API key
    key_res = subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-t","-c",
        f"SELECT 'sk_test_' || id || '__' || substr(key_hash,1,20) FROM api_keys WHERE merchant_id='{MID}' LIMIT 1;"], capture_output=True, text=True)
    K = "sk_test_mer_GxcWEznOTk__FTfhQ2_wRH563JIFwhQeczbqD9Y"
    print(f"Using existing: {MID}")

# ── Clean ──
print("Cleaning...")
tables = ["credits","payment_methods","processed_events","audit_log","webhook_delivery_attempts","webhook_events","webhook_endpoints","invoices","subscriptions","customers","plans"]
for t in tables:
    subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-c",f"DELETE FROM {t} WHERE merchant_id='{MID}' OR merchant_id IS NULL;"], capture_output=True)

# ── 4 Core Plans + 1 Legacy ──
plans = {}
plan_data = [
    ("Basic", "Perfect for individuals starting their fitness journey.", 990000),
    ("Pro", "For dedicated members who want full access and training.", 2990000),
    ("Elite", "Premium experience with personal training and recovery.", 7990000),
    ("Corporate", "Complete wellness solution for your entire team.", 24900000),
]
for name, desc, amount in plan_data:
    r = api("POST", "/v1/plans", {"name":name,"description":desc,"amount":amount,"currency":"NGN","interval":"monthly","interval_count":1})
    plans[name.lower()] = r["data"]["id"]
    print(f"  {name}: {plans[name.lower()]} (N{amount/100:,.0f}/mo)")

# Legacy
r = api("POST", "/v1/plans", {"name":"Basic (Legacy)","description":"Grandfathered plan.","amount":490000,"currency":"NGN","interval":"monthly","interval_count":1})
subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-c",f"UPDATE plans SET is_active = false WHERE id = '{r['data']['id']}';"], capture_output=True)
plans["legacy"] = r["data"]["id"]

# ── 250 Customers ──
first_names = ["Adeola","Chinedu","Fatima","Emeka","Blessing","Tunde","Ngozi","Yusuf","Grace","David","Ifeoma","Musa","Sarah","Obinna","Zainab","Kelechi","Aisha","John","Adaobi","Oluwaseun","Chinaza","Ibrahim","Folake","Uche","Hauwa","Seyi","Nneka","Tobi","Moji","Ebuka","Chiamaka","Yemi","Bimpe","Bayo","Ronke","Sola","Lola","Femi","Dapo","Wale","Amara","Chuka","Efe","Gbenga","Halima","Ifeanyi","Jumoke","Kola","Lara","Moses"]
last_names = ["Ibrahim","Okonkwo","Bello","Nwosu","Adeyemi","Bakare","Eze","Mohammed","Oluwole","Chukwu","Abdullahi","Johnson","Okafor","Usman","Madu","Bala","Peters","Obi","Adebayo","Musa","Abubakar","Nwachukwu","Ogunleye","Akpan","Ekong","Oladipo","Balogun","Ajayi","Lawal","Nwankwo","Ogunbanjo","Bankole","Alabi","Suleiman","Danjuma","Okoro","Adesina","Onyeka","Taiwo","Kehinde","Idris","Garba","Emenike","Olamide","Somto","Chibueze","Nnamdi","Oluwadare","Titilayo","Abiola"]
used_names = set()
customers = []
for i in range(250):
    while True:
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        if name not in used_names: used_names.add(name); break
    email = f"user{i}@demo.dev"
    d = api("POST", "/v1/customers", {"name": name, "email": email})
    customers.append(d["data"]["id"])
    if (i+1) % 50 == 0: print(f"  {i+1}/250 customers")

# ── Backdate customers across 12 months ──
for cid in customers:
    days_ago = random.randint(5, 365)
    created = (datetime.datetime.now() - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
    subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-c",f"UPDATE customers SET created_at = '{created}' WHERE id = '{cid}';"], capture_output=True)
print("  Customers backdated")

# ── 250 Subscriptions ──
plan_keys = list(plans.keys())[:4]  # basic, pro, elite, corporate
dist = [("basic",90), ("pro",80), ("elite",45), ("corporate",25)]  # 240 active
for plan_key, count in dist:
    for i in range(count):
        idx = sum(d[1] for d in dist if d[0] < plan_key) + i
        if idx >= len(customers): break
        months_ago = random.randint(0, 8)
        start = (datetime.datetime.now() - datetime.timedelta(days=30*months_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
        api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": plans[plan_key], "start_date": start})

# 5 cancelled
for i, reason in enumerate(["Switched to competitor","Budget constraints","No longer needed","Moving","Business closed"]):
    idx = 240 + i
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["basic"], plans["pro"]]), "start_date": (datetime.datetime.now() - datetime.timedelta(days=180)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    # Cancel it
    subs = api("GET", "/v1/subscriptions")["data"]
    sub = [s for s in subs if s["customer_id"] == customers[idx]]
    if sub: api("POST", f"/v1/subscriptions/{sub[0]['id']}/cancel", {"reason": reason})

# 3 paused
for i in range(3):
    idx = 245 + i
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["pro"], plans["elite"]]), "start_date": (datetime.datetime.now() - datetime.timedelta(days=120)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    subs = api("GET", "/v1/subscriptions")["data"]
    sub = [s for s in subs if s["customer_id"] == customers[idx]]
    if sub: api("POST", f"/v1/subscriptions/{sub[0]['id']}/pause", {})

# 2 trialing
for i in range(2):
    idx = 248 + i
    trial_end = (datetime.datetime.now() + datetime.timedelta(days=random.randint(3,10))).strftime("%Y-%m-%dT%H:%M:%SZ")
    api("POST", "/v1/subscriptions", {"customer_id": customers[idx], "plan_id": random.choice([plans["pro"], plans["elite"]]), "start_date": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"), "trial_end": trial_end})

print(f"  Subscriptions created")

# ── Payment Methods for 80 customers ──
brands = ["visa","mastercard","verve"]
for i in random.sample(range(250), 80):
    api("POST", "/v1/payment-methods", {"customer_id": customers[i], "type":"card", "nomba_token":f"tok_demo_{i}", "last4":str(random.randint(1000,9999)), "brand":random.choice(brands), "is_default":True})
print("  Payment methods added")

# ── Generate Multi-Month Invoice History ──
subs = api("GET", "/v1/subscriptions")["data"]
for sub in subs:
    if sub["state"] == "trialing": continue
    started = datetime.datetime.fromisoformat(sub["current_period_start"].replace("Z","+00:00"))
    now = datetime.datetime.now(datetime.timezone.utc)
    months_active = max(1, (now.year - started.year) * 12 + (now.month - started.month))
    amount = plan_data[[p[0].lower() for p in plan_data].index(
        next(k for k,v in plans.items() if v == sub["plan_id"])
    )][2] if sub["plan_id"] in plans.values() else 990000
    
    for m in range(months_active):
        due = (started + datetime.timedelta(days=30*m)).strftime("%Y-%m-%dT%H:%M:%SZ")
        paid = (started + datetime.timedelta(days=30*m+1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        inv_id = f"inv_{sub['id'][:8]}_{m}"
        subprocess.run(["docker","exec","infra-postgres-1","psql","-U","railswitch","-d","railswitch","-c",
            f"INSERT INTO invoices (id, subscription_id, merchant_id, amount, currency, status, due_date, paid_at, created_at) VALUES ('{inv_id}', '{sub['id']}', '{MID}', {amount}, 'NGN', 'paid', '{due}', '{paid}', '{due}') ON CONFLICT DO NOTHING;"], capture_output=True)

print("  Invoice history generated")

# ── Verify ──
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

print(f"\n═══ FITCORE NIGERIA DEMO ═══")
print(f"Merchant: {MID}")
print(f"Customers: {len(custs)}")
print(f"Plans: {len(plans_list)}")
print(f"Subscriptions: {len(subs)} — {st}")
print(f"Active: {len(active)}")
print(f"MRR: N{mrr/100:,.0f}")
print(f"ARR: N{mrr*12/100:,.0f}")
print(f"Plans: {plan_dist}")
print(f"Churn: {st.get('cancelled',0)}/{len(subs)} = {round(st.get('cancelled',0)/len(subs)*100,1)}%")
print(f"\nLogin: demo@railswitch.dev / demo123456")
print(f"Dashboard: http://localhost:3000/dashboard")
print(f"Storefront: http://localhost:3200")
