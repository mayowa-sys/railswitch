// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanInterval = "monthly" | "quarterly" | "annually";
export type PlanStatus = "active" | "archived";
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "cancelled"
  | "paused"
  | "trialing";
export type CascadeStep =
  | "card"
  | "retry"
  | "virtual_account"
  | "ussd"
  | "whatsapp";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // kobo
  interval: PlanInterval;
  trialDays: number;
  status: PlanStatus;
  subscriberCount: number;
  createdAt: string;
}

export interface PaymentMethod {
  type: "card" | "bank_account";
  last4: string;
  brand?: string;
  bank?: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalRevenue: number; // kobo
  activeSubscriptions: number;
  paymentMethods: PaymentMethod[];
  createdAt: string;
}

export interface CascadeAttempt {
  step: CascadeStep;
  status: "success" | "failed" | "pending";
  attemptedAt: string;
  note?: string;
}

export interface Subscription {
  id: string;
  planId: string;
  customerId: string;
  status: SubscriptionStatus;
  startedAt: string;
  nextBillingDate: string;
  amount: number; // kobo
  cascadeHistory: CascadeAttempt[];
  billingHistory: BillingRecord[];
}

export interface BillingRecord {
  id: string;
  amount: number;
  status: "paid" | "failed" | "refunded";
  date: string;
  method: CascadeStep;
}

export interface FailedPayment {
  id: string;
  customerId: string;
  subscriptionId: string;
  amount: number;
  reason: string;
  cascadeStepReached: CascadeStep;
  attemptedAt: string;
}

export interface WebhookEvent {
  id: string;
  event: string;
  endpoint: string;
  statusCode: number;
  deliveredAt: string;
  latency: number; // ms
}

export interface AuditEntry {
  id: string;
  subscriptionId: string;
  actor: string;
  actorType: "system" | "merchant" | "customer";
  fromState: SubscriptionStatus | "created" | "—";
  toState: SubscriptionStatus | "created";
  reason: string;
  timestamp: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    description: "Perfect for individuals and small teams getting started.",
    price: 990000,
    interval: "monthly",
    trialDays: 14,
    status: "active",
    subscriberCount: 312,
    createdAt: "2025-11-01T09:00:00Z",
  },
  {
    id: "plan_growth",
    name: "Growth",
    description: "For growing businesses that need more power and integrations.",
    price: 2990000,
    interval: "monthly",
    trialDays: 7,
    status: "active",
    subscriberCount: 874,
    createdAt: "2025-11-01T09:00:00Z",
  },
  {
    id: "plan_pro",
    name: "Pro",
    description: "Advanced analytics, priority support, custom webhooks.",
    price: 7990000,
    interval: "monthly",
    trialDays: 0,
    status: "active",
    subscriberCount: 203,
    createdAt: "2025-12-15T09:00:00Z",
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    description: "Dedicated infrastructure and SLA-backed uptime guarantees.",
    price: 29900000,
    interval: "monthly",
    trialDays: 0,
    status: "active",
    subscriberCount: 41,
    createdAt: "2026-01-20T09:00:00Z",
  },
  {
    id: "plan_annual_growth",
    name: "Growth (Annual)",
    description: "Growth plan billed annually — 2 months free.",
    price: 29900000,
    interval: "annually",
    trialDays: 0,
    status: "active",
    subscriberCount: 156,
    createdAt: "2026-02-01T09:00:00Z",
  },
  {
    id: "plan_legacy_basic",
    name: "Basic (Legacy)",
    description: "No longer offered to new customers.",
    price: 490000,
    interval: "monthly",
    trialDays: 0,
    status: "archived",
    subscriberCount: 88,
    createdAt: "2025-09-01T09:00:00Z",
  },
];

// ─── Customers ────────────────────────────────────────────────────────────────

export const CUSTOMERS: Customer[] = [
  {
    id: "cust_001",
    name: "Adeola Martins",
    email: "adeola.martins@naijamusicpro.ng",
    phone: "+234 803 412 5567",
    totalRevenue: 47880000,
    activeSubscriptions: 2,
    paymentMethods: [
      { type: "card", last4: "4521", brand: "Mastercard", isDefault: true },
      { type: "bank_account", last4: "3312", bank: "GTBank", isDefault: false },
    ],
    createdAt: "2025-11-12T10:22:00Z",
  },
  {
    id: "cust_002",
    name: "Chinedu Okafor",
    email: "chinedu.okafor@techbridge.com.ng",
    phone: "+234 706 881 2230",
    totalRevenue: 23940000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "card", last4: "8801", brand: "Visa", isDefault: true },
    ],
    createdAt: "2025-12-01T08:15:00Z",
  },
  {
    id: "cust_003",
    name: "Isioma Nwosu",
    email: "isioma@nwosu-designs.ng",
    phone: "+234 812 334 9910",
    totalRevenue: 11960000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "card", last4: "2290", brand: "Verve", isDefault: true },
      { type: "bank_account", last4: "7712", bank: "Zenith Bank", isDefault: false },
    ],
    createdAt: "2026-01-05T11:00:00Z",
  },
  {
    id: "cust_004",
    name: "Wale Adesina",
    email: "wale.adesina@lagosdigital.ng",
    phone: "+234 901 567 4401",
    totalRevenue: 89700000,
    activeSubscriptions: 3,
    paymentMethods: [
      { type: "card", last4: "5544", brand: "Mastercard", isDefault: true },
    ],
    createdAt: "2025-11-01T09:00:00Z",
  },
  {
    id: "cust_005",
    name: "Ngozi Bello",
    email: "ngozi.bello@belloboutique.com",
    phone: "+234 805 223 8876",
    totalRevenue: 5980000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "bank_account", last4: "9901", bank: "Access Bank", isDefault: true },
    ],
    createdAt: "2026-02-14T14:30:00Z",
  },
  {
    id: "cust_006",
    name: "Emeka Eze",
    email: "emeka.eze@ezelogistics.ng",
    phone: "+234 703 991 0045",
    totalRevenue: 35880000,
    activeSubscriptions: 2,
    paymentMethods: [
      { type: "card", last4: "3371", brand: "Visa", isDefault: true },
      { type: "card", last4: "6612", brand: "Mastercard", isDefault: false },
    ],
    createdAt: "2025-12-20T07:45:00Z",
  },
  {
    id: "cust_007",
    name: "Amaka Obi",
    email: "amaka@obicatering.ng",
    phone: "+234 810 445 7723",
    totalRevenue: 8970000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "card", last4: "1192", brand: "Verve", isDefault: true },
    ],
    createdAt: "2026-03-01T10:10:00Z",
  },
  {
    id: "cust_008",
    name: "Tunde Fashola",
    email: "tunde.fashola@fashtech.io",
    phone: "+234 908 112 6634",
    totalRevenue: 143760000,
    activeSubscriptions: 4,
    paymentMethods: [
      { type: "card", last4: "8833", brand: "Mastercard", isDefault: true },
      { type: "bank_account", last4: "4421", bank: "First Bank", isDefault: false },
    ],
    createdAt: "2025-10-15T09:00:00Z",
  },
  {
    id: "cust_009",
    name: "Kemi Adeyemi",
    email: "kemi.adeyemi@brightfuture.edu.ng",
    phone: "+234 802 774 5512",
    totalRevenue: 14960000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "card", last4: "6601", brand: "Visa", isDefault: true },
    ],
    createdAt: "2026-01-18T13:20:00Z",
  },
  {
    id: "cust_010",
    name: "Babatunde Ogundimu",
    email: "b.ogundimu@ogunproperties.ng",
    phone: "+234 705 334 8821",
    totalRevenue: 71880000,
    activeSubscriptions: 2,
    paymentMethods: [
      { type: "card", last4: "2298", brand: "Mastercard", isDefault: true },
    ],
    createdAt: "2025-11-28T08:30:00Z",
  },
  {
    id: "cust_011",
    name: "Chisom Onyeka",
    email: "chisom.onyeka@csonmedia.ng",
    phone: "+234 813 667 0032",
    totalRevenue: 17940000,
    activeSubscriptions: 1,
    paymentMethods: [
      { type: "bank_account", last4: "5521", bank: "UBA", isDefault: true },
    ],
    createdAt: "2026-02-03T11:00:00Z",
  },
  {
    id: "cust_012",
    name: "Rotimi Ajayi",
    email: "rotimi.ajayi@ajayiconsults.com",
    phone: "+234 902 881 4456",
    totalRevenue: 35940000,
    activeSubscriptions: 2,
    paymentMethods: [
      { type: "card", last4: "4490", brand: "Visa", isDefault: true },
    ],
    createdAt: "2025-12-10T09:45:00Z",
  },
];

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub_a1b2c3",
    planId: "plan_growth",
    customerId: "cust_001",
    status: "active",
    startedAt: "2025-11-12T10:22:00Z",
    nextBillingDate: "2026-07-12T10:22:00Z",
    amount: 2990000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2026-06-12T10:22:00Z" },
    ],
    billingHistory: [
      { id: "bil_001", amount: 2990000, status: "paid", date: "2026-06-12", method: "card" },
      { id: "bil_002", amount: 2990000, status: "paid", date: "2026-05-12", method: "card" },
      { id: "bil_003", amount: 2990000, status: "paid", date: "2026-04-12", method: "card" },
    ],
  },
  {
    id: "sub_d4e5f6",
    planId: "plan_pro",
    customerId: "cust_001",
    status: "active",
    startedAt: "2026-01-01T09:00:00Z",
    nextBillingDate: "2026-07-01T09:00:00Z",
    amount: 7990000,
    cascadeHistory: [
      { step: "card", status: "failed", attemptedAt: "2026-06-01T09:00:00Z", note: "Insufficient funds" },
      { step: "retry", status: "failed", attemptedAt: "2026-06-03T09:00:00Z" },
      { step: "virtual_account", status: "success", attemptedAt: "2026-06-04T14:12:00Z", note: "Customer transferred ₦7,990.00" },
    ],
    billingHistory: [
      { id: "bil_004", amount: 7990000, status: "paid", date: "2026-06-04", method: "virtual_account" },
      { id: "bil_005", amount: 7990000, status: "paid", date: "2026-05-01", method: "card" },
    ],
  },
  {
    id: "sub_g7h8i9",
    planId: "plan_starter",
    customerId: "cust_002",
    status: "active",
    startedAt: "2025-12-01T08:15:00Z",
    nextBillingDate: "2026-07-01T08:15:00Z",
    amount: 990000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2026-06-01T08:15:00Z" },
    ],
    billingHistory: [
      { id: "bil_006", amount: 990000, status: "paid", date: "2026-06-01", method: "card" },
      { id: "bil_007", amount: 990000, status: "paid", date: "2026-05-01", method: "card" },
    ],
  },
  {
    id: "sub_j1k2l3",
    planId: "plan_growth",
    customerId: "cust_003",
    status: "past_due",
    startedAt: "2026-01-05T11:00:00Z",
    nextBillingDate: "2026-06-05T11:00:00Z",
    amount: 2990000,
    cascadeHistory: [
      { step: "card", status: "failed", attemptedAt: "2026-06-05T11:00:00Z", note: "Card declined" },
      { step: "retry", status: "failed", attemptedAt: "2026-06-07T11:00:00Z" },
      { step: "virtual_account", status: "failed", attemptedAt: "2026-06-09T11:00:00Z", note: "No transfer received within 48h" },
      { step: "ussd", status: "pending", attemptedAt: "2026-06-10T09:00:00Z" },
    ],
    billingHistory: [
      { id: "bil_008", amount: 2990000, status: "failed", date: "2026-06-05", method: "card" },
      { id: "bil_009", amount: 2990000, status: "paid", date: "2026-05-05", method: "card" },
    ],
  },
  {
    id: "sub_m4n5o6",
    planId: "plan_enterprise",
    customerId: "cust_004",
    status: "active",
    startedAt: "2025-11-01T09:00:00Z",
    nextBillingDate: "2026-07-01T09:00:00Z",
    amount: 29900000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2026-06-01T09:00:00Z" },
    ],
    billingHistory: [
      { id: "bil_010", amount: 29900000, status: "paid", date: "2026-06-01", method: "card" },
      { id: "bil_011", amount: 29900000, status: "paid", date: "2026-05-01", method: "card" },
      { id: "bil_012", amount: 29900000, status: "paid", date: "2026-04-01", method: "card" },
    ],
  },
  {
    id: "sub_p7q8r9",
    planId: "plan_starter",
    customerId: "cust_005",
    status: "trialing",
    startedAt: "2026-06-10T14:30:00Z",
    nextBillingDate: "2026-06-24T14:30:00Z",
    amount: 990000,
    cascadeHistory: [],
    billingHistory: [],
  },
  {
    id: "sub_s1t2u3",
    planId: "plan_annual_growth",
    customerId: "cust_006",
    status: "active",
    startedAt: "2025-12-20T07:45:00Z",
    nextBillingDate: "2026-12-20T07:45:00Z",
    amount: 29900000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2025-12-20T07:45:00Z" },
    ],
    billingHistory: [
      { id: "bil_013", amount: 29900000, status: "paid", date: "2025-12-20", method: "card" },
    ],
  },
  {
    id: "sub_v4w5x6",
    planId: "plan_growth",
    customerId: "cust_007",
    status: "paused",
    startedAt: "2026-03-01T10:10:00Z",
    nextBillingDate: "2026-07-01T10:10:00Z",
    amount: 2990000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2026-06-01T10:10:00Z" },
    ],
    billingHistory: [
      { id: "bil_014", amount: 2990000, status: "paid", date: "2026-06-01", method: "card" },
    ],
  },
  {
    id: "sub_y7z8a9",
    planId: "plan_enterprise",
    customerId: "cust_008",
    status: "active",
    startedAt: "2025-10-15T09:00:00Z",
    nextBillingDate: "2026-07-15T09:00:00Z",
    amount: 29900000,
    cascadeHistory: [
      { step: "card", status: "failed", attemptedAt: "2026-06-15T09:00:00Z", note: "Insufficient funds" },
      { step: "retry", status: "success", attemptedAt: "2026-06-16T09:00:00Z" },
    ],
    billingHistory: [
      { id: "bil_015", amount: 29900000, status: "paid", date: "2026-06-16", method: "retry" },
      { id: "bil_016", amount: 29900000, status: "paid", date: "2026-05-15", method: "card" },
    ],
  },
  {
    id: "sub_b1c2d3",
    planId: "plan_starter",
    customerId: "cust_009",
    status: "cancelled",
    startedAt: "2026-01-18T13:20:00Z",
    nextBillingDate: "2026-06-18T13:20:00Z",
    amount: 990000,
    cascadeHistory: [],
    billingHistory: [
      { id: "bil_017", amount: 990000, status: "paid", date: "2026-05-18", method: "card" },
      { id: "bil_018", amount: 990000, status: "paid", date: "2026-04-18", method: "card" },
    ],
  },
  {
    id: "sub_e4f5g6",
    planId: "plan_pro",
    customerId: "cust_010",
    status: "active",
    startedAt: "2025-11-28T08:30:00Z",
    nextBillingDate: "2026-07-28T08:30:00Z",
    amount: 7990000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2026-06-28T08:30:00Z" },
    ],
    billingHistory: [
      { id: "bil_019", amount: 7990000, status: "paid", date: "2026-06-28", method: "card" },
    ],
  },
  {
    id: "sub_h7i8j9",
    planId: "plan_growth",
    customerId: "cust_011",
    status: "past_due",
    startedAt: "2026-02-03T11:00:00Z",
    nextBillingDate: "2026-06-03T11:00:00Z",
    amount: 2990000,
    cascadeHistory: [
      { step: "card", status: "failed", attemptedAt: "2026-06-03T11:00:00Z", note: "Card expired" },
      { step: "whatsapp", status: "pending", attemptedAt: "2026-06-04T09:00:00Z" },
    ],
    billingHistory: [
      { id: "bil_020", amount: 2990000, status: "failed", date: "2026-06-03", method: "card" },
      { id: "bil_021", amount: 2990000, status: "paid", date: "2026-05-03", method: "card" },
    ],
  },
  {
    id: "sub_k1l2m3",
    planId: "plan_annual_growth",
    customerId: "cust_012",
    status: "active",
    startedAt: "2025-12-10T09:45:00Z",
    nextBillingDate: "2026-12-10T09:45:00Z",
    amount: 29900000,
    cascadeHistory: [
      { step: "card", status: "success", attemptedAt: "2025-12-10T09:45:00Z" },
    ],
    billingHistory: [
      { id: "bil_022", amount: 29900000, status: "paid", date: "2025-12-10", method: "card" },
    ],
  },
];

// ─── Failed Payments ──────────────────────────────────────────────────────────

export const FAILED_PAYMENTS: FailedPayment[] = [
  {
    id: "fail_001",
    customerId: "cust_003",
    subscriptionId: "sub_j1k2l3",
    amount: 2990000,
    reason: "Insufficient funds",
    cascadeStepReached: "ussd",
    attemptedAt: "2026-06-05T11:00:00Z",
  },
  {
    id: "fail_002",
    customerId: "cust_011",
    subscriptionId: "sub_h7i8j9",
    amount: 2990000,
    reason: "Card expired",
    cascadeStepReached: "whatsapp",
    attemptedAt: "2026-06-03T11:00:00Z",
  },
  {
    id: "fail_003",
    customerId: "cust_008",
    subscriptionId: "sub_y7z8a9",
    amount: 29900000,
    reason: "Insufficient funds",
    cascadeStepReached: "retry",
    attemptedAt: "2026-06-15T09:00:00Z",
  },
  {
    id: "fail_004",
    customerId: "cust_001",
    subscriptionId: "sub_d4e5f6",
    amount: 7990000,
    reason: "Do not honour",
    cascadeStepReached: "virtual_account",
    attemptedAt: "2026-06-01T09:00:00Z",
  },
  {
    id: "fail_005",
    customerId: "cust_006",
    subscriptionId: "sub_s1t2u3",
    amount: 2990000,
    reason: "Card declined",
    cascadeStepReached: "retry",
    attemptedAt: "2026-05-20T09:00:00Z",
  },
];

// ─── Webhook Events ───────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  { id: "wh_001", event: "subscription.payment.success", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 200, deliveredAt: "2026-06-22T10:22:01Z", latency: 143 },
  { id: "wh_002", event: "subscription.payment.failed", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 200, deliveredAt: "2026-06-22T09:15:42Z", latency: 289 },
  { id: "wh_003", event: "subscription.cascade.started", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 500, deliveredAt: "2026-06-22T09:15:43Z", latency: 4012 },
  { id: "wh_004", event: "subscription.cascade.success", endpoint: "https://hooks.zapier.com/catch/1234/abcde", statusCode: 200, deliveredAt: "2026-06-21T14:05:12Z", latency: 88 },
  { id: "wh_005", event: "customer.subscription.cancelled", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 404, deliveredAt: "2026-06-20T18:44:09Z", latency: 1234 },
  { id: "wh_006", event: "subscription.trial.ending", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 200, deliveredAt: "2026-06-20T08:00:01Z", latency: 102 },
  { id: "wh_007", event: "subscription.payment.success", endpoint: "https://hooks.zapier.com/catch/1234/abcde", statusCode: 200, deliveredAt: "2026-06-19T10:22:05Z", latency: 77 },
  { id: "wh_008", event: "subscription.status.updated", endpoint: "https://api.acme.ng/webhooks/rail", statusCode: 200, deliveredAt: "2026-06-19T10:23:10Z", latency: 201 },
];

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const AUDIT_LOG: AuditEntry[] = [
  { id: "aud_001", subscriptionId: "sub_a1b2c3", actor: "system", actorType: "system", fromState: "—", toState: "active", reason: "New subscription created after successful payment", timestamp: "2025-11-12T10:22:01Z" },
  { id: "aud_002", subscriptionId: "sub_j1k2l3", actor: "system", actorType: "system", fromState: "active", toState: "past_due", reason: "Card payment failed — cascade in progress", timestamp: "2026-06-05T11:00:45Z" },
  { id: "aud_003", subscriptionId: "sub_v4w5x6", actor: "mayowa@naijamusicpro.ng", actorType: "merchant", fromState: "active", toState: "paused", reason: "Merchant manually paused subscription on request", timestamp: "2026-06-15T14:30:00Z" },
  { id: "aud_004", subscriptionId: "sub_b1c2d3", actor: "kemi.adeyemi@brightfuture.edu.ng", actorType: "customer", fromState: "active", toState: "cancelled", reason: "Customer cancelled via self-serve portal", timestamp: "2026-06-18T09:10:00Z" },
  { id: "aud_005", subscriptionId: "sub_d4e5f6", actor: "system", actorType: "system", fromState: "active", toState: "past_due", reason: "Card payment failed — cascade started", timestamp: "2026-06-01T09:00:10Z" },
  { id: "aud_006", subscriptionId: "sub_d4e5f6", actor: "system", actorType: "system", fromState: "past_due", toState: "active", reason: "Payment recovered via virtual account transfer", timestamp: "2026-06-04T14:12:30Z" },
  { id: "aud_007", subscriptionId: "sub_h7i8j9", actor: "system", actorType: "system", fromState: "active", toState: "past_due", reason: "Card expired during billing cycle", timestamp: "2026-06-03T11:00:55Z" },
  { id: "aud_008", subscriptionId: "sub_p7q8r9", actor: "system", actorType: "system", fromState: "—", toState: "trialing", reason: "Trial started — card not yet charged", timestamp: "2026-06-10T14:30:00Z" },
  { id: "aud_009", subscriptionId: "sub_y7z8a9", actor: "system", actorType: "system", fromState: "active", toState: "past_due", reason: "Card declined — retry scheduled", timestamp: "2026-06-15T09:00:12Z" },
  { id: "aud_010", subscriptionId: "sub_y7z8a9", actor: "system", actorType: "system", fromState: "past_due", toState: "active", reason: "Smart retry succeeded on second attempt", timestamp: "2026-06-16T09:00:08Z" },
  { id: "aud_011", subscriptionId: "sub_m4n5o6", actor: "system", actorType: "system", fromState: "—", toState: "active", reason: "Enterprise onboarding completed", timestamp: "2025-11-01T09:00:00Z" },
  { id: "aud_012", subscriptionId: "sub_s1t2u3", actor: "system", actorType: "system", fromState: "—", toState: "active", reason: "Annual plan activated — payment confirmed", timestamp: "2025-12-20T07:45:30Z" },
];

// ─── Helper: format kobo to ₦ ─────────────────────────────────────────────────

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

export function getPlanById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getCustomerById(id: string): Customer | undefined {
  return CUSTOMERS.find((c) => c.id === id);
}

export function getSubscriptionsByCustomer(customerId: string): Subscription[] {
  return SUBSCRIPTIONS.filter((s) => s.customerId === customerId);
}

export function getAuditBySubscription(subscriptionId: string): AuditEntry[] {
  return AUDIT_LOG.filter((a) => a.subscriptionId === subscriptionId);
}

// ─── Overview stats ───────────────────────────────────────────────────────────

export const OVERVIEW_STATS = {
  mrr: 87430000, // ₦874,300
  arr: 1049160000, // ₦10,491,600
  activeSubscribers: 2350,
  churnRate: 3.2, // %
  recoveryRate: 73.4, // cards recovered / cards failed
  cardFailureRate: 24.1, // %
};

export const REVENUE_BARS = [
  { day: "Mon", collected: 4200000, recovered: 890000 },
  { day: "Tue", collected: 6100000, recovered: 1200000 },
  { day: "Wed", collected: 3800000, recovered: 420000 },
  { day: "Thu", collected: 7400000, recovered: 1980000 },
  { day: "Fri", collected: 5500000, recovered: 1100000 },
  { day: "Sat", collected: 8900000, recovered: 2200000 },
  { day: "Sun", collected: 8100000, recovered: 1700000 },
];
