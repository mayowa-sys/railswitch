# RailSwitch — Demo Video Script (3 Minutes)

> Updated 2026-07-06 — Numbers reflect production seed data.
> Record at 1080p, Chrome incognito, 125% zoom.

---

## Pre-Recording Checklist

```bash
# 1. Wake the dashboard (auto-stop)
open https://railswitch-dashboard.fly.dev

# 2. Log in: demo@railswitch.dev / demo123456

# 3. Wake the storefront
open https://railswitch-storefront.fly.dev

# 4. Generate a portal link (replace CUSTOMER_ID with a real one):
curl -s -X POST "https://railswitch-gateway.fly.dev/v1/portal/customers/409046deb19d41928f92/link" \
  -H "Authorization: Bearer sk_test_mer_k_W0XspbNN__y70_WaK_hR1iJU7qn95WUclycPU" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['portal_url'])"

# 5. Have the portal URL open in a tab
# 6. Close any extra tabs, clear notifications
```

---

## SCRIPT (3:00)

### [0:00–0:20] — HOOK + PROBLEM
> *Voiceover*: "Nigerian SaaS businesses lose 20–40% of recurring revenue to failed card payments. RailSwitch fixes this with an intelligent payment recovery engine built on Nomba."

**Visual**: Title card "RailSwitch" → cut to storefront pricing page.
Show: Basic (₦9,900), Pro (₦29,900), Elite (₦79,000), Corporate (₦249,000) plans.

---

### [0:20–0:55] — STOREFRONT: DECLINE CARD → VA FALLBACK (35s)

> *Voiceover*: "A customer signs up for FitCore Nigeria's Basic plan..."

1. Click **Basic Plan** (₦9,900/mo) → "Get Started"
2. Fill in: name, email, phone
3. Click **"Decline Card"** quick-fill button (5060 6666 6666 6666 674)
4. Submit → after 1.5s, the **VA Fallback page** appears:
   - "Card Payment Unsuccessful"
   - Bank transfer details: account number, bank name, amount, reference
   - Step-by-step payment instructions

> *Voiceover*: "When the card fails, RailSwitch instantly creates a Nomba virtual account and shows the customer exactly how to pay via bank transfer — no churn, no lost revenue."

---

### [0:55–1:35] — DASHBOARD OVERVIEW (40s)

> *Voiceover*: "The merchant dashboard shows the full picture..."

1. **Overview** — point at each KPI:
   - **MRR card** (gradient purple) — monthly recurring revenue
   - **Active Subscribers** — 285 customers
   - **Recovery Rate** — failed cards successfully recovered
   - **Churn Rate**
2. **Revenue chart** — MRR per plan (bar chart)
3. **Webhook feed** — recent events (charge succeeded, va_fallback, etc.)
4. Click **Failed Payments** table at bottom

> *Voiceover*: "Merchants see real-time MRR, recovery metrics, and every webhook event as it arrives."

---

### [0:55–1:35, cont.] — SUBSCRIPTIONS WITH CASCADE

5. Click **Subscriptions** in sidebar
6. Hover over the **State** column — show the cascade states: active, retrying, va_fallback, whatsapp_fallback, past_due
7. Click a cascade-state subscription → view detail

> *Voiceover*: "Every subscription shows its position in the recovery pipeline. You can see at a glance which customers are in card retry, which have a virtual account open, and which need WhatsApp follow-up."

---

### [1:35–2:10] — PLAYGROUND: FULL CASCADE DEMO (35s)

> *Voiceover*: "Let me show you the recovery engine in action..."

1. Click **Playground** in sidebar
2. Click **"Full Cascade Demo"**
3. Watch the live event log populate step by step:
   - Sub created + card tokenized + charge attempted
   - `CHARGE_FAILED` (non-retryable decline, responseCode 62)
   - State: `active` → `va_fallback`
   - VA created via Nomba API (shows account number, bank, expiry)
   - VA funded webhook fires
   - State: `va_fallback` → `active` (recovered!)

> *Voiceover*: "The Full Cascade Demo walks the entire lifecycle: card charge fails, a virtual account is created, the customer pays via transfer, and the subscription recovers automatically — all driven by Nomba webhooks with HMAC-SHA256 verification."

---

### [2:10–2:40] — CUSTOMER PORTAL + WEBHOOKS (30s)

> *Voiceover*: "Customers get self-service control via a secure, token-based portal..."

1. Open the **pre-generated portal URL** for Jumoke Bakare
2. Show **Overview**: plan name, status (active), next billing date, payment method (Visa •••• XXXX)
3. Click **Invoices** → show invoice list
4. Click **Subscriptions** → show current plan with Change Plan button
5. Click **Settings** → show Pause / Resume / Cancel buttons

> *Voiceover*: "The portal is authenticated with a cryptographically-signed HMAC token that expires after 7 days. No API keys are exposed to the customer."

6. Quick cut to **Webhooks** page on dashboard:
   - Show endpoint (https://httpbin.org/post)
   - Show delivery log with status + HTTP code

> *Voiceover*: "All events — charges, VA creations, state changes — are delivered as signed webhooks to merchant endpoints with 9-step exponential backoff."

---

### [2:40–3:00] — ARCHITECTURE + CLOSE (20s)

> *Voiceover*: "RailSwitch is built as two services on Fly.io: an Express engine for billing logic and state machines, and a FastAPI gateway for the public REST API. PostgreSQL with row-level security isolates every merchant. Engine tests pass at 100%."

**Show on screen**:
- Architecture diagram (gateway → engine → PostgreSQL + Nomba)
- GitHub: `github.com/mayowa-sys/railswitch`
- "Built for Nomba Hackathon 2026"

> *Voiceover*: "RailSwitch. Stripe collects recurring revenue. RailSwitch recovers it."

---

## Demo Credentials (keep on screen 3s at end)

```
Dashboard: https://railswitch-dashboard.fly.dev
Email:     demo@railswitch.dev
Password:  demo123456

Storefront:  https://railswitch-storefront.fly.dev
Portal:      https://railswitch-portal.fly.dev
API Gateway: https://railswitch-gateway.fly.dev
```

---

## What's Real vs Fallback

| Feature | Status |
|---------|--------|
| Storefront signup + plan selection | Real API |
| Decline Card → VA fallback page | Real API + Nomba sandbox |
| Dashboard overview (MRR, KPIs) | Real DB (285 customers, 291 subs) |
| Dashboard analytics (revenue trend, lifecycle) | Real DB (1,658 invoices) |
| Subscriptions page (cascade states) | Real DB (retrying, va_fallback, etc.) |
| Playground (Card Charge, Full Cascade, VA Funded) | Real webhooks + state machine |
| Portal (customer data, invoices, settings) | Real API + HMAC tokens |
| Portal pause/resume/cancel | Real state machine transitions |
| Webhook delivery log | Real HTTP POST with HMAC signatures |
| Architecture / RLS / multi-tenancy | Real PostgreSQL RLS policies |

---

## Recording Tips

- **Pause 1 second** between clicks so viewers can follow
- **Use mouse highlight** (Zoom or ScreenFlow cursor effect)
- **Narrate as you click** — don't read the script; know the beats
- **Speed up** playground wait times by 2× in post if too slow
- Keep voice energetic but conversational
- If a page is cold-starting (Fly auto-stop), cut to the next scene and come back
