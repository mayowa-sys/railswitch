"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  CreditCard, Landmark, RefreshCw, Zap,
  CheckCircle2, XCircle, ArrowRight, Loader2, Play,
} from "lucide-react";

interface LogEntry {
  id: string;
  event: string;
  detail: string;
  status: "success" | "error" | "info";
  time: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  "payment_success": <CreditCard className="size-3.5" />,
  "virtual_account.funded": <Landmark className="size-3.5" />,
  "charge.failed": <XCircle className="size-3.5" />,
  "webhook": <Zap className="size-3.5" />,
  "cascade": <RefreshCw className="size-3.5" />,
};

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEMO_API_KEY = process.env.NEXT_PUBLIC_DEMO_API_KEY ?? "sk_test_mer_2fDBVGY7fs__Jt79FedYxBAdNiY6tuN_YxPjaIE";

const FIRST_NAMES = ["Amina","Chidi","Fatima","Emeka","Blessing","Tunde","Ngozi","Yusuf","Grace"];
const LAST_NAMES = ["Ibrahim","Okonkwo","Bello","Nwosu","Adeyemi","Bakare","Eze","Mohammed","Oluwole"];

function randomName() {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}

export default function PlaygroundPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState("");
  const [response, setResponse] = useState("");

  const addLog = (event: string, detail: string, status: LogEntry["status"] = "success") => {
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

  const signNombaWebhook = async (payload: Record<string, unknown>) => {
    const secret = "NombaHackathon2026";
    const ts = String(Math.floor(Date.now() / 1000));
    const data = payload.data as Record<string, unknown> || {};
    const merchant = (data.merchant || {}) as Record<string, unknown>;
    const transaction = (data.transaction || {}) as Record<string, unknown>;

    const signingFields = [
      payload.event_type,
      payload.requestId,
      merchant.userId || "",
      merchant.walletId || "",
      transaction.transactionId || "",
      transaction.type || "",
      transaction.time || "",
      transaction.responseCode || "",
      ts,
    ];
    const signingString = signingFields.join(":");
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signingString));
    const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    return { sig, ts };
  };

  const sendWebhook = async (payload: Record<string, unknown>) => {
    const { sig, ts } = await signNombaWebhook(payload);
    return fetch(`${GATEWAY_URL}/webhooks/nomba`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "nomba-signature": sig,
        "nomba-timestamp": ts,
        "nomba-signature-algorithm": "HmacSHA256",
      },
      body: JSON.stringify(payload),
    });
  };

  const cleanup = (customerId: string, planId: string, subId: string) => {
    fetch(`${GATEWAY_URL}/v1/cleanup/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}` },
      body: JSON.stringify({ customer_id: customerId, plan_id: planId, subscription_id: subId })
    }).catch(() => {});
  };

  const createTestSetup = async (planAmount = 9900) => {
    const name = randomName();
    const customer = await gatewayPost("/v1/customers", { name, email: `test_${Date.now()}@playground.dev` });
    addLog("customer.created", `${name} (${customer.id})`);

    const plan = await gatewayPost("/v1/plans", {
      name: `Test ${Date.now().toString(36).slice(-4)}`,
      amount: planAmount, description: "Playground test plan",
      currency: "NGN", interval: "monthly", interval_count: 1,
    });
    addLog("plan.created", `${plan.name} (N${Number(plan.amount)/100}/mo)`);

    const sub = await gatewayPost("/v1/subscriptions", {
      customer_id: customer.id, plan_id: plan.id, start_date: new Date().toISOString(),
    });
    addLog("subscription.created", `${sub.id} (state: ${sub.state})`);

    return { customer, plan, sub };
  };

  // ─── Simulate Charge ────────────────────────────────────────────────
  const simulateCharge = async (cardKey: string) => {
    setLoading(cardKey);
    setResponse("");
    const shouldSucceed = cardKey === "success";

    try {
      addLog("system", "Creating test customer...");
      const { customer, plan, sub } = await createTestSetup();

      await gatewayPost("/v1/payment-methods", {
        customer_id: customer.id, type: "card",
        nomba_token: shouldSucceed ? "tok_success" : "tok_insufficient",
        last4: shouldSucceed ? "6666" : "6674", brand: "mastercard", is_default: true,
      });
      addLog("payment_method.added", `Card ending ${shouldSucceed ? "6666" : "6674"}`);

      const payload = {
        event_type: "payment_success",
        requestId: `wh_${Date.now()}`,
        data: {
          merchant: { merchantTxRef: sub.id, amount: shouldSucceed ? 9900 : 0 },
          transaction: {
            status: shouldSucceed ? "SUCCESS" : "FAILED",
            responseCode: shouldSucceed ? "00" : "51",
            message: shouldSucceed ? "Approved" : "Insufficient funds",
          },
        },
      };

      const webhookRes = await sendWebhook(payload);
      addLog(
        shouldSucceed ? "payment_success" : "charge.failed",
        `Webhook ${webhookRes.ok ? "accepted" : "rejected"} (HTTP ${webhookRes.status})`,
        webhookRes.ok ? "success" : "error"
      );

      await new Promise((r) => setTimeout(r, 2000));
      const updatedSub = await gatewayGet(`/v1/subscriptions/${sub.id}`);

      addLog("cascade",
        shouldSucceed
          ? `Subscription: ${updatedSub.state}`
          : `Subscription: ${updatedSub.state} (expected retrying)`,
        shouldSucceed ? "success" : "info"
      );

      setResponse(JSON.stringify(updatedSub, null, 2));
      cleanup(customer.id, plan.id, sub.id);
      addLog("cleanup", "Test data removed from dashboard");

    } catch (err) {
      setResponse(String(err));
      addLog("error", `${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading("");
    }
  };

  // ─── Full Cascade Demo ──────────────────────────────────────────────
  const simulateFullCascade = async () => {
    setLoading("cascade");
    setResponse("");
    try {
      addLog("system", "Creating test customer...");
      const { customer, plan, sub } = await createTestSetup();

      await gatewayPost("/v1/payment-methods", {
        customer_id: customer.id, type: "card",
        nomba_token: "tok_insufficient",
        last4: "6674", brand: "mastercard", is_default: true,
      });
      addLog("payment_method.added", "Card ending 6674");

      // Step 1: Send non-retryable failure (declined = not retryable) → va_fallback
      addLog("cascade", "Step 1: Sending non-retryable card decline...");
      const payload1 = {
        event_type: "payment_success",
        requestId: `wh_fail_${Date.now()}`,
        data: {
          merchant: { merchantTxRef: sub.id, amount: 9900 },
          transaction: {
            status: "FAILED",
            responseCode: "62",  // Restricted card = non-retryable
            message: "Restricted card",
          },
        },
      };
      const res1 = await sendWebhook(payload1);
      addLog("charge.failed", `Non-retryable failure (HTTP ${res1.status})`, "success");

      await new Promise((r) => setTimeout(r, 3000));
      const sub1 = await gatewayGet(`/v1/subscriptions/${sub.id}`);
      addLog("cascade", `State: ${sub1.state}`, "info");
      setResponse(JSON.stringify(sub1, null, 2));

      // Step 2: VA was created by cascade coordinator — check state
      if (sub1.state === "va_fallback") {
        addLog("cascade", `Step 2: VA fallback active — VA ID: ${sub1.va_id || "creating..."}`, "info");
        await new Promise((r) => setTimeout(r, 2000));
        const sub2 = await gatewayGet(`/v1/subscriptions/${sub.id}`);
        setResponse(JSON.stringify(sub2, null, 2));

        if (sub2.va_id) {
          addLog("virtual_account.created", `VA: ${sub2.va_id}, expires: ${sub2.va_expires_at}`, "success");
        }

        // Step 3: Customer funds the VA → recovered to active
        addLog("cascade", "Step 3: Simulating VA funding...");
        const payloadVA = {
          event_type: "virtual_account.funded",
          requestId: `wh_va_${Date.now()}`,
          data: {
            accountRef: sub2.current_invoice_id || `inv_${sub.id}_${Date.now()}`,
            accountNumber: sub2.va_id || "8227727373",
            bankName: "Nombank MFB",
            amountReceived: 9900,
            amountExpected: 9900,
          },
        };
        const resVA = await sendWebhook(payloadVA);
        addLog("virtual_account.funded", `VA funded (HTTP ${resVA.status})`, "success");

        await new Promise((r) => setTimeout(r, 2000));
        const sub3 = await gatewayGet(`/v1/subscriptions/${sub.id}`);
        addLog("cascade", `Final state: ${sub3.state}`, "success");
        setResponse(JSON.stringify(sub3, null, 2));
      } else {
        addLog("cascade", `Unexpected state: ${sub1.state}`, "error");
      }

      cleanup(customer.id, plan.id, sub.id);
      addLog("cleanup", "Test data removed from dashboard");

    } catch (err) {
      setResponse(String(err));
      addLog("error", `${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading("");
    }
  };

  // ─── Simulate VA Funded ─────────────────────────────────────────────
  const simulateVAFunded = async () => {
    setLoading("va");
    setResponse("");
    try {
      const { customer, plan, sub } = await createTestSetup(5000);

      // Send failure to get to va_fallback
      addLog("cascade", "Getting subscription to va_fallback...");
      const failPayload = {
        event_type: "payment_success",
        requestId: `wh_fail_va_${Date.now()}`,
        data: {
          merchant: { merchantTxRef: sub.id, amount: 5000 },
          transaction: { status: "FAILED", responseCode: "62", message: "Restricted card" },
        },
      };
      await sendWebhook(failPayload);
      await new Promise((r) => setTimeout(r, 3000));

      const subState = await gatewayGet(`/v1/subscriptions/${sub.id}`);
      addLog("cascade", `State: ${subState.state}`, "info");

      if (subState.state === "va_fallback") {
        const payloadVA = {
          event_type: "virtual_account.funded",
          requestId: `wh_va_${Date.now()}`,
          data: {
            accountRef: subState.current_invoice_id || `inv_${sub.id}_${Date.now()}`,
            accountNumber: subState.va_id || "8227727373",
            bankName: "Nombank MFB",
            amountReceived: 5000,
            amountExpected: 5000,
          },
        };
        const resVA = await sendWebhook(payloadVA);
        addLog("virtual_account.funded", `VA funded (HTTP ${resVA.status})`, "success");

        await new Promise((r) => setTimeout(r, 2000));
        const final = await gatewayGet(`/v1/subscriptions/${sub.id}`);
        addLog("cascade", `Final state: ${final.state}`, "success");
        setResponse(JSON.stringify(final, null, 2));
      }

      cleanup(customer.id, plan.id, sub.id);
      addLog("cleanup", "Test data removed from dashboard");

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
          {/* Card Charge */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Card Charge</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Creates customer → plan → subscription, then sends a payment webhook.</p>
            <div className="grid gap-2">
              {[
                { label: "Success (5060...666)", key: "success", desc: "Card charged successfully → active" },
                { label: "Insufficient (5060...674)", key: "insufficient", desc: "Retryable failure → retrying" },
              ].map((card) => (
                <div key={card.key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{card.label}</p>
                    <p className="text-[10px] text-zinc-400">{card.desc}</p>
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

          {/* Full Cascade */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="size-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Full Cascade Demo</h3>
            </div>
            <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70 mb-4">
              Walks through the entire dunning lifecycle: charge → decline → VA fallback → VA funded → recovered.
            </p>
            <button
              onClick={simulateFullCascade}
              disabled={loading !== ""}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition-colors"
            >
              {loading === "cascade" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Run Full Cascade
            </button>
            <div className="mt-3 grid grid-cols-4 gap-1 text-center">
              {["active", "retrying→va_fallback", "VA funded", "active"].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-full h-1.5 rounded-full bg-indigo-200 dark:bg-indigo-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: "100%" }} />
                  </div>
                  <span className="text-[9px] text-indigo-500 dark:text-indigo-400 leading-tight">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* VA Funded */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">VA Funded (Direct)</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Creates sub → triggers VA fallback → simulates VA funding.</p>
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
                    <div className={`shrink-0 mt-0.5 ${log.status === "success" ? "text-emerald-500" : log.status === "error" ? "text-red-500" : "text-blue-500"}`}>
                      {EVENT_ICONS[log.event] || <Zap className="size-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">{log.event}</p>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">{log.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{log.detail}</p>
                    </div>
                    {log.status === "success" ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : log.status === "error" ? <XCircle className="size-3.5 text-red-500 shrink-0" /> : <ArrowRight className="size-3.5 text-blue-500 shrink-0" />}
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
