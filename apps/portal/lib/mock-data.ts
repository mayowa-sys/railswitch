// ─── Mock Types ────────────────────────────────────────────────────────────────

export type PlanInterval = "monthly" | "annually";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "paused" | "trialing";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // in kobo (1 Naira = 100 kobo)
  interval: PlanInterval;
}

export interface PaymentMethod {
  id: string;
  type: "card" | "bank_account";
  last4: string;
  brand?: string;
  bankName?: string;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  planName: string;
  amount: number; // in kobo
  status: "paid" | "failed" | "pending";
  date: string;
  method: string;
}

export interface Subscription {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  nextBillingDate: string;
  paymentMethodId: string;
  reason?: string; // cancellation reason
}

// ─── Plan Presets (matching dashboard) ────────────────────────────────────────

export const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    description: "Perfect for individuals and small teams getting started.",
    price: 990000, // ₦9,900
    interval: "monthly",
  },
  {
    id: "plan_growth",
    name: "Growth",
    description: "For growing businesses that need more power and integrations.",
    price: 2990000, // ₦29,900
    interval: "monthly",
  },
  {
    id: "plan_pro",
    name: "Pro",
    description: "Advanced analytics, priority support, custom webhooks.",
    price: 7990000, // ₦79,900
    interval: "monthly",
  },
];

// ─── Seed Data ────────────────────────────────────────────────────────────────

const DEFAULT_SUBSCRIPTION: Subscription = {
  id: "sub_jd123",
  planId: "plan_starter",
  status: "active",
  nextBillingDate: "July 15, 2026",
  paymentMethodId: "pm_1",
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm_1",
    type: "card",
    last4: "4242",
    brand: "Visa",
    isDefault: true,
  },
  {
    id: "pm_2",
    type: "bank_account",
    last4: "5678",
    bankName: "Wema Bank",
    isDefault: false,
  },
];

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "INV-2026-004",
    planName: "Starter Plan",
    amount: 990000,
    status: "paid",
    date: "June 15, 2026",
    method: "Visa Card (•••• 4242)",
  },
  {
    id: "INV-2026-003",
    planName: "Starter Plan",
    amount: 990000,
    status: "paid",
    date: "May 15, 2026",
    method: "Visa Card (•••• 4242)",
  },
  {
    id: "INV-2026-002",
    planName: "Setup Fee",
    amount: 490000,
    status: "paid",
    date: "April 22, 2026",
    method: "Visa Card (•••• 4242)",
  },
  {
    id: "INV-2026-001",
    planName: "Starter Plan (Trial)",
    amount: 0,
    status: "paid",
    date: "April 08, 2026",
    method: "Visa Card (•••• 4242)",
  },
];

// ─── LocalStorage State Synchronization Helpers ─────────────────────────────────

const KEY_SUBSCRIPTION = "railswitch_portal_sub";
const KEY_PAYMENT_METHODS = "railswitch_portal_pms";
const KEY_INVOICES = "railswitch_portal_invoices";

export function getServerPortalState() {
  return {
    subscription: DEFAULT_SUBSCRIPTION,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    invoices: DEFAULT_INVOICES,
  };
}

export function loadPortalState() {
  if (typeof window === "undefined") {
    return getServerPortalState();
  }

  const storedSub = localStorage.getItem(KEY_SUBSCRIPTION);
  const storedPms = localStorage.getItem(KEY_PAYMENT_METHODS);
  const storedInvoices = localStorage.getItem(KEY_INVOICES);

  let subscription = DEFAULT_SUBSCRIPTION;
  if (storedSub && storedSub !== "undefined" && storedSub !== "null") {
    try {
      const parsed = JSON.parse(storedSub);
      if (parsed && typeof parsed === "object") {
        subscription = parsed as Subscription;
      }
    } catch (e) {
      console.error("Error parsing subscription from localStorage:", e);
    }
  }

  let paymentMethods = DEFAULT_PAYMENT_METHODS;
  if (storedPms && storedPms !== "undefined" && storedPms !== "null") {
    try {
      const parsed = JSON.parse(storedPms);
      if (Array.isArray(parsed)) {
        paymentMethods = parsed as PaymentMethod[];
      }
    } catch (e) {
      console.error("Error parsing payment methods from localStorage:", e);
    }
  }

  let invoices = DEFAULT_INVOICES;
  if (storedInvoices && storedInvoices !== "undefined" && storedInvoices !== "null") {
    try {
      const parsed = JSON.parse(storedInvoices);
      if (Array.isArray(parsed)) {
        invoices = parsed as Invoice[];
      }
    } catch (e) {
      console.error("Error parsing invoices from localStorage:", e);
    }
  }

  return {
    subscription,
    paymentMethods,
    invoices,
  };
}

export function savePortalState(state: {
  subscription?: Subscription;
  paymentMethods?: PaymentMethod[];
  invoices?: Invoice[];
}) {
  if (typeof window === "undefined") return;

  if (state.subscription) {
    localStorage.setItem(KEY_SUBSCRIPTION, JSON.stringify(state.subscription));
  }
  if (state.paymentMethods) {
    localStorage.setItem(KEY_PAYMENT_METHODS, JSON.stringify(state.paymentMethods));
  }
  if (state.invoices) {
    localStorage.setItem(KEY_INVOICES, JSON.stringify(state.invoices));
  }

  // Dispatch storage event to keep other tabs in sync
  window.dispatchEvent(new Event("storage"));
}

export function resetPortalState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_SUBSCRIPTION);
  localStorage.removeItem(KEY_PAYMENT_METHODS);
  localStorage.removeItem(KEY_INVOICES);
  window.dispatchEvent(new Event("storage"));
}

// ─── Helper: format kobo to ₦ ─────────────────────────────────────────────────

export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
