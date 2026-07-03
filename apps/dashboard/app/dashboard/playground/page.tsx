"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  CreditCard, Landmark, RefreshCw, Zap,
  CheckCircle2, XCircle, ArrowRight, Loader2,
} from "lucide-react";

interface LogEntry {
  id: string;
  event: string;
  detail: string;
  status: "success" | "error";
  time: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  "payment_success": <CreditCard className="size-3.5" />,
  "virtual_account.funded": <Landmark className="size-3.5" />,
  "charge.failed": <XCircle className="size-3.5" />,
  "webhook": <Zap className="size-3.5" />,
  "cascade": <RefreshCw className="size-3.5" />,
};

const DEMO_API_KEY = "sk_test_mer_Jrh7prq25H__LdcbgIggue0HbHscrLYO3zhZy1g";
const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_AUTH = "local-dev-shared-secret";

const TEST_CARDS = [
  { label: "Success (5060...666)", key: "success" },
  { label: "Insufficient (5060...674)", key: "insufficient" },
];

const FIRST_NAMES = ["Amina","Chidi","Fatima","Emeka","Blessing","Tunde","Ngozi","Yusuf","Grace"];
const LAST_NAMES = ["Ibrahim","Okonkwo","Bello","Nwosu","Adeyemi","Bakare","Eze","Mohammed","Oluwole"];

function randomName() {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}


export default function PlaygroundPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState("");
  const [response, setResponse] = useState("");

  const addLog = (event: string, detail: string, status: "success" | "error" = "success") => {
    setLogs((prev) => [{ id: Math.random().toString(36).slice(2, 8), event, detail, status, time: new Date().toLocaleTimeString("en-NG") }, ...prev].slice(0, 50));
  };

  const gatewayPost = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? json.detail ?? `HTTP ${res.status}`);
    return json.data ?? json;
  };

  const gatewayGet = async (path: string) => {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      headers: { Authorization: `Bearer ${DEMO_API_KEY}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? json.detail ?? `HTTP ${res.status}`);
    return json.data ?? json;
  };

  const simulateCharge = async (cardKey: string) => {
    setLoading(cardKey);
    setResponse("");
    const shouldSucceed = cardKey === "success";

    try {
      // Step 1: Create customer
      addLog("system", "Creating test customer...", "success");
      const name = randomName();
      const customer = await gatewayPost("/v1/customers", { name, email: `test_${Date.now()}@playground.dev` });
      addLog("customer.created", `${name} (${customer.id})`, "success");

      // Step 2: Create plan
      const plan = await gatewayPost("/v1/plans", {
        name: `Test ${Date.now().toString(36).slice(-4)}`,
        amount: 9900, description: "Test plan for cascade simulation",
        currency: "NGN",
        interval: "monthly",
        interval_count: 1,
      });
      addLog("plan.created", `${plan.name} (N${Number(plan.amount)/100}/mo)`, "success");

      // Step 3: Create subscription
      const sub = await gatewayPost("/v1/subscriptions", {
        customer_id: customer.id,
        plan_id: plan.id,
        start_date: new Date().toISOString(),
      });
      addLog("subscription.created", `${sub.id} (state: ${sub.state})`, "success");

      // Step 4: Create payment method
      await gatewayPost("/v1/payment-methods", {
        customer_id: customer.id,
        type: "card",
        nomba_token: shouldSucceed ? "tok_success" : "tok_insufficient",
        last4: shouldSucceed ? "6666" : "6674",
        brand: "mastercard",
        is_default: true,
      });
      addLog("payment_method.added", `Card ending ${shouldSucceed ? "6666" : "6674"}`, "success");

      // Step 5: Create a real invoice in the database
      const invoiceId = `inv_${sub.id}_${Date.now()}`;
      
      // Create invoice via API
      await fetch(`${GATEWAY_URL}/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}` },
        body: JSON.stringify({
          subscription_id: sub.id,
          amount: 9900,
          due_date: new Date().toISOString()
        })
      }).catch(() => {});
      const secret = "NombaHackathon2026";
      const ts = String(Math.floor(Date.now() / 1000));
      const payload = {
        event_type: "payment_success",
        requestId: `wh_${Date.now()}`,
        data: {
          merchant: {
            merchantTxRef: sub.id,
            amount: shouldSucceed ? 9900 : 0,
          },
          transaction: {
            status: shouldSucceed ? "SUCCESS" : "FAILED",
            responseCode: shouldSucceed ? "00" : "51",
            message: shouldSucceed ? "Approved" : "Insufficient funds",
          },
        },
      };

      const encoder = new TextEncoder();
      const body = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, body)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const webhookRes = await fetch(`${GATEWAY_URL}/webhooks/nomba`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "nomba-signature": sig,
          "nomba-timestamp": ts,
          "nomba-signature-algorithm": "HmacSHA256",
        },
        body: JSON.stringify(payload),
      });

      addLog(
        shouldSucceed ? "payment_success" : "charge.failed",
        `Webhook ${webhookRes.ok ? "accepted" : "rejected"} (HTTP ${webhookRes.status})`,
        webhookRes.ok ? "success" : "error"
      );

      // Step 6: Wait and check subscription state
      await new Promise((r) => setTimeout(r, 2000));
      const updatedSub = await gatewayGet(`/v1/subscriptions/${sub.id}`);

      addLog("cascade",
        shouldSucceed
          ? `Subscription: ${updatedSub.state}`
          : `Subscription: ${updatedSub.state} (expected retrying/va_fallback)`,
        shouldSucceed ? "success" : "error"
      );

      setResponse(JSON.stringify(updatedSub, null, 2));
      // Clean up test data
      fetch(`${GATEWAY_URL}/v1/cleanup/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}` },
        body: JSON.stringify({ customer_id: customer.id, plan_id: plan.id, subscription_id: sub.id })
      }).catch(() => {});
      addLog("cleanup", "Test data removed from dashboard", "success");

    } catch (err) {
      setResponse(String(err));
      addLog("error", `${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading("");
    }
  };

  const simulateVAFunded = async () => {
    setLoading("va");
    setResponse("");
    try {
      const name = randomName();
      const customer = await gatewayPost("/v1/customers", { name, email: `va_${Date.now()}@playground.dev` });
      const plan = await gatewayPost("/v1/plans", {
        name: `VA Test ${Date.now().toString(36).slice(-4)}`,
        amount: 5000, description: "Test plan for VA simulation",
        currency: "NGN",
        interval: "monthly",
        interval_count: 1,
      });
      const sub = await gatewayPost("/v1/subscriptions", {
        customer_id: customer.id,
        plan_id: plan.id,
        start_date: new Date().toISOString(),
      });

      addLog("system", `Created subscription ${sub.id}`, "success");

      const invoiceId = `inv_${sub.id}_${Date.now()}`;
      const secret = "NombaHackathon2026";
      const ts = String(Math.floor(Date.now() / 1000));
      const payload = {
        event_type: "virtual_account.funded",
        requestId: `wh_va_${Date.now()}`,
        data: {
          accountRef: invoiceId,
          accountNumber: "8227727373",
          bankName: "Nombank MFB",
          amountReceived: 5000,
          amountExpected: 5000,
        },
      };

      const encoder = new TextEncoder();
      const body = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, body)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch(`${GATEWAY_URL}/webhooks/nomba`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "nomba-signature": sig,
          "nomba-timestamp": ts,
          "nomba-signature-algorithm": "HmacSHA256",
        },
        body: JSON.stringify(payload),
      });

      await new Promise((r) => setTimeout(r, 2000));
      const updatedSub = await gatewayGet(`/v1/subscriptions/${sub.id}`);

      addLog("virtual_account.funded", `State: ${updatedSub.state}`, "success");
      setResponse(JSON.stringify(updatedSub, null, 2));
      // Clean up test data
      fetch(`${GATEWAY_URL}/v1/cleanup/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}` },
        body: JSON.stringify({ customer_id: customer.id, plan_id: plan.id, subscription_id: sub.id })
      }).catch(() => {});
      addLog("cleanup", "Test data removed from dashboard", "success");

    } catch (err) {
      setResponse(String(err));
      addLog("error", `${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Webhook Playground" description="End-to-end cascade simulation — creates real subscriptions and sends Nomba webhooks." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Card Charge Simulation</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Creates customer → plan → subscription, then sends a Nomba payment webhook.</p>
            <div className="grid gap-2">
              {TEST_CARDS.map((card) => (
                <div key={card.key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{card.label}</p>
                  </div>
                  <button
                    onClick={() => simulateCharge(card.key)}
                    disabled={loading !== ""}
                    className="h-8 px-3 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {loading === card.key ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                    Charge
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Virtual Account Simulation</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Creates subscription, then simulates a VA funding webhook.</p>
            <button
              onClick={simulateVAFunded}
              disabled={loading !== ""}
              className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors text-left w-full disabled:opacity-50"
            >
              <Landmark className="size-5 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Simulate VA Transfer</p>
                <p className="text-[10px] text-zinc-500">Customer transfers to virtual account</p>
              </div>
              {loading === "va" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 text-zinc-400" />}
            </button>
          </div>

          {response && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 p-4">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Response</p>
              <pre className="text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono max-h-48 overflow-auto">{response}</pre>
            </div>
          )}
        </div>

        <div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Event Log</h3>
              {logs.length > 0 && (
                <button onClick={() => { setLogs([]); setResponse(""); }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  Clear
                </button>
              )}
            </div>
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <Zap className="size-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No events yet</p>
                <p className="text-[11px] text-zinc-400 mt-1">Click a simulation button to test the cascade.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/30">
                    <div className={`shrink-0 mt-0.5 ${log.status === "success" ? "text-emerald-500" : "text-red-500"}`}>
                      {EVENT_ICONS[log.event] || <Zap className="size-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">{log.event}</p>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">{log.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{log.detail}</p>
                    </div>
                    {log.status === "success" ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : <XCircle className="size-3.5 text-red-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
