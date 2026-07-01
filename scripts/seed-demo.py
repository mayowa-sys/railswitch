"""
RailSwitch Demo Data Seeder
Creates a clean, professional demo environment:
- 4 plans (Starter, Professional, Business, Enterprise + 1 Legacy archived)
- 250 customers with realistic Nigerian names
- ~240 active subscriptions across plans
- 5 cancelled, 3 paused, 2 trialing
- Payment methods for 60 customers
- Realistic subscription dates spanning past 6 months
"""
import subprocess, json, random, sys

H = "http://localhost:8000"
K = "sk_test_mer_HfDzRi_p6G___5GjJ2qsjwpi1eRVU0Hw-2GvTEc"
MID = "mer_HfDzRi_p6G"

def api(method, path, body=None):
    args = ["curl", "-s", "-X", method, f"{H}{path}", "-H", "Content-Type: application/json", "-H", f"Authorization: Bearer {K}"]
    if body: args += ["-d", json.dumps(body)]
    result = subprocess.run(args, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        print(f"API ERROR: {result.stdout[:200]}", file=sys.stderr)
        return {}

# ─── Step 1: Clean everything ───
print("Cleaning existing demo data...")
tables = ["payment_methods", "processed_events", "audit_log", "subscriptions", "customers", "plans"]
for table in tables:
    subprocess.run(["docker", "exec", "infra-postgres-1", "psql", "-U", "railswitch", "-d", "railswitch", "-c",
        f"DELETE FROM {table} WHERE merchant_id='{MID}';"], capture_output=True)
print("  Cleaned.")

# ─── Step 2: Create 4 real plans + 1 legacy ───
print("\nCreating plans...")
plans = {}

plans["starter"] = api("POST", "/v1/plans", {
    "name": "Starter",
    "description": "Perfect for individuals and small projects getting started with recurring billing.",
    "amount": 990000,   # ₦9,900/month in kobo
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
})["data"]["id"]

plans["professional"] = api("POST", "/v1/plans", {
    "name": "Professional",
    "description": "For growing businesses that need advanced recovery and priority support.",
    "amount": 2990000,  # ₦29,900/month
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
})["data"]["id"]

plans["business"] = api("POST", "/v1/plans", {
    "name": "Business",
    "description": "For established companies with high-volume subscription revenue.",
    "amount": 7990000,  # ₦79,900/month
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
})["data"]["id"]

plans["enterprise"] = api("POST", "/v1/plans", {
    "name": "Enterprise",
    "description": "Dedicated infrastructure, SLA-backed uptime, custom integrations, and priority support.",
    "amount": 24900000, # ₦249,000/month
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
})["data"]["id"]

# Legacy plan (archived)
api("POST", "/v1/plans", {
    "name": "Basic (Legacy)",
    "description": "Grandfathered plan — no longer available to new customers.",
    "amount": 490000,   # ₦4,900/month
    "currency": "NGN",
    "interval": "monthly",
    "interval_count": 1,
})
# Archive the legacy plan
legacy = api("GET", "/v1/plans")["data"]
legacy_plan = [p for p in legacy if p["name"] == "Basic (Legacy)"][0]
subprocess.run(["docker", "exec", "infra-postgres-1", "psql", "-U", "railswitch", "-d", "railswitch", "-c",
    f"UPDATE plans SET is_active = false WHERE id = '{legacy_plan['id']}';"], capture_output=True)

plans["legacy"] = legacy_plan["id"]
print(f"  Starter:      {plans['starter']}  (₦9,900/mo)")
print(f"  Professional: {plans['professional']}  (₦29,900/mo)")
print(f"  Business:     {plans['business']}  (₦79,900/mo)")
print(f"  Enterprise:   {plans['enterprise']}  (₦249,000/mo)")
print(f"  Legacy:       {plans['legacy']}  (₦4,900/mo — archived)")

# ─── Step 3: Create 250 customers ───
print("\nCreating 250 customers...")
first_names = [
    "Adeola", "Chinedu", "Fatima", "Emeka", "Blessing", "Tunde", "Ngozi", "Yusuf", "Grace", "David",
    "Ifeoma", "Musa", "Sarah", "Obinna", "Zainab", "Kelechi", "Aisha", "John", "Adaobi", "Oluwaseun",
    "Chinaza", "Ibrahim", "Folake", "Uche", "Hauwa", "Seyi", "Nneka", "Tobi", "Moji", "Ebuka",
    "Chiamaka", "Yemi", "Bimpe", "Bayo", "Ronke", "Sola", "Lola", "Femi", "Dapo", "Wale",
    "Amara", "Chuka", "Efe", "Gbenga", "Halima", "Ifeanyi", "Jumoke", "Kola", "Lara", "Moses"
]
last_names = [
    "Ibrahim", "Okonkwo", "Bello", "Nwosu", "Adeyemi", "Bakare", "Eze", "Mohammed", "Oluwole", "Chukwu",
    "Abdullahi", "Johnson", "Okafor", "Usman", "Madu", "Bala", "Peters", "Obi", "Adebayo", "Musa",
    "Abubakar", "Nwachukwu", "Ogunleye", "Akpan", "Ekong", "Oladipo", "Balogun", "Ajayi", "Lawal", "Nwankwo",
    "Ogunbanjo", "Bankole", "Alabi", "Suleiman", "Danjuma", "Okoro", "Adesina", "Onyeka", "Taiwo", "Kehinde",
    "Idris", "Garba", "Emenike", "Olamide", "Somto", "Chibueze", "Nnamdi", "Oluwadare", "Titilayo", "Abiola"
]

used_names = set()
customers = []
for i in range(250):
    while True:
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        if name not in used_names:
            used_names.add(name)
            break
    email = f"user{i}@demo.dev"
    d = api("POST", "/v1/customers", {"name": name, "email": email})
    customers.append(d["data"]["id"])
    if (i + 1) % 50 == 0:
        print(f"  {i + 1}/250 customers")

# ─── Step 4: Create subscriptions ───
# Distribution: 90 Starter, 80 Professional, 45 Business, 25 Enterprise = 240 active
# + 5 cancelled, 3 paused, 2 trialing = 250 total
print("\nCreating 250 subscriptions...")

import datetime

def random_date(months_ago):
    """Random date within the past N months"""
    days = random.randint(0, months_ago * 30)
    d = datetime.datetime.now() - datetime.timedelta(days=days)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")

# Active subscriptions
for i in range(90):
    api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": plans["starter"], "start_date": random_date(6)})

for i in range(90, 170):
    api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": plans["professional"], "start_date": random_date(6)})

for i in range(170, 215):
    api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": plans["business"], "start_date": random_date(6)})

for i in range(215, 240):
    api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": plans["enterprise"], "start_date": random_date(3)})

# 5 cancelled
for i, reason in [(240, "Switched to competitor"), (241, "Budget constraints"), (242, "No longer needed"), (243, "Moving to annual billing"), (244, "Business closed")]:
    s = api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": random.choice([plans["starter"], plans["professional"]]), "start_date": random_date(8)})["data"]["id"]
    api("POST", f"/v1/subscriptions/{s}/cancel", {"reason": reason})

# 3 paused
for i in [245, 246, 247]:
    s = api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": random.choice([plans["professional"], plans["business"]]), "start_date": random_date(4)})["data"]["id"]
    api("POST", f"/v1/subscriptions/{s}/pause", {})

# 2 trialing
for i in [248, 249]:
    trial_end = (datetime.datetime.now() + datetime.timedelta(days=random.randint(3, 10))).strftime("%Y-%m-%dT%H:%M:%SZ")
    api("POST", "/v1/subscriptions", {"customer_id": customers[i], "plan_id": random.choice([plans["professional"], plans["business"]]), "start_date": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"), "trial_end": trial_end})

print("  Subscriptions created.")

# ─── Step 5: Payment methods ───
print("\nAdding payment methods for 80 customers...")
card_brands = ["visa", "mastercard", "verve"]
for i in random.sample(range(250), 80):
    api("POST", "/v1/payment-methods", {
        "customer_id": customers[i],
        "type": "card",
        "nomba_token": f"tok_demo_{i}",
        "last4": str(random.randint(1000, 9999)),
        "brand": random.choice(card_brands),
        "is_default": True,
    })
print("  Payment methods added.")

# ─── Step 6: Verify ───
print("\n═══ VERIFICATION ═══")
subs = api("GET", "/v1/subscriptions")["data"]
plans_data = api("GET", "/v1/plans")["data"]
custs = api("GET", "/v1/customers")["data"]

st = {}
for s in subs:
    st[s.get("state", "?")] = st.get(s.get("state", "?"), 0) + 1

active = [s for s in subs if s["state"] == "active"]
plan_map = {p["id"]: int(p["amount"]) for p in plans_data}
mrr_kobo = sum(plan_map.get(s["plan_id"], 0) for s in active)
mrr_naira = mrr_kobo / 100

plan_dist = {}
for s in active:
    pname = next((p["name"] for p in plans_data if p["id"] == s["plan_id"]), "Unknown")
    plan_dist[pname] = plan_dist.get(pname, 0) + 1

print(f"Customers: {len(custs)}")
print(f"Plans: {len(plans_data)}")
print(f"Subscriptions: {len(subs)} — {st}")
print(f"Active: {len(active)}")
print(f"MRR: ₦{mrr_naira:,.0f}")
print(f"ARR: ₦{mrr_naira * 12:,.0f}")
print(f"Plan distribution: {plan_dist}")
print(f"Churn: {st.get('cancelled', 0)}/{len(subs)} = {round(st.get('cancelled', 0)/len(subs)*100, 1)}%")
print(f"\nDemo ready at http://localhost:3000/dashboard")
print(f"Login: demo@railswitch.dev / demo123456")
