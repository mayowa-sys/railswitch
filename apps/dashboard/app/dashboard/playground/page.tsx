"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";
import { CreditCard, AlertTriangle, Landmark, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

const TEST_CARDS = [
  { label: "Success (5060...6666)", number: "5060 6666 6666 6666 666", outcome: "success" as const },
  { label: "Insufficient Funds", number: "5060 6666 6666 6666 674", outcome: "insufficient" as const },
  { label: "Expired Card", number: "4000 0000 0000 0069", outcome: "expired" as const },
  { label: "Generic Decline", number: "4000 0000 0000 0002", outcome: "decline" as const },
];

interface StateEvent {
  id: string;
  event: string;
  detail: string;
  status: "success" | "error" | "pending";
  time: string;
}

export default function PlaygroundPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<StateEvent[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>("");

  const addEvent = (event: string, detail: string, status: StateEvent["status"]) => {
    const ev: StateEvent = {
      id: Math.random().toString(36).slice(2, 8),
      event, detail, status,
      time: new Date().toLocaleTimeString("en-NG"),
    };
    setEvents((prev) => [ev, ...prev].slice(0, 20));
  };

  const handleSimulateCharge = async (outcome: string) => {
    setLoading(outcome);
    setLastResponse("");
    try {
      // Use a throwaway merchant so we don't pollute the demo data
      const API = "http://localhost:8000";
      const ts = Date.now();
      const regRes = await fetch(`${API}/v1/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Playground", email: `pg-${ts}@test.dev`, password: "pgtest12345" }),
      });
      const reg = await regRes.json();
      const key = reg.data?.api_key;
      if (!key) throw new Error("Failed to create test merchant");

      const planRes = await fetch(`${API}/v1/plans`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ name: "Test Plan", description: "Temp", amount: 5000, currency: "NGN", interval: "monthly", interval_count: 1 }),
      });
      const plan = await planRes.json();

      const custRes = await fetch(`${API}/v1/customers`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ name: "Test Customer", email: `cust-${ts}@test.dev` }),
      });
      const cust = await custRes.json();

      const subRes = await fetch(`${API}/v1/subscriptions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ customer_id: cust.data?.id, plan_id: plan.data?.id, start_date: new Date().toISOString() }),
      });
      const sub = await subRes.json();

      const pmRes = await fetch(`${API}/v1/payment-methods`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ customer_id: cust.data?.id, type: "card", nomba_token: `tok_${ts}`, last4: "6666", brand: "visa" }),
      });

      // Pause + resume to trigger state machine
      await fetch(`${API}/v1/subscriptions/${sub.data?.id}/pause`, {
        method: "POST", headers: { Authorization: `Bearer ${key}` }, body: "{}",
      });
      await fetch(`${API}/v1/subscriptions/${sub.data?.id}/resume`, {
        method: "POST", headers: { Authorization: `Bearer ${key}` }, body: "{}",
      });

      // Get final state
      const finalRes = await fetch(`${API}/v1/subscriptions/${sub.data?.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const finalData = await finalRes.json();
      const state = finalData.state || finalData.data?.state || "active";

      setLastResponse(JSON.stringify({ merchant: reg.data?.merchant?.id, subscription: sub.data?.id, state, outcome }, null, 2));
      addEvent("subscription.test", `Created sub (${state}) — outcome: ${outcome}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResponse(msg);
      addEvent("charge.error", msg, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleSimulateVA = async () => {
    setLoading("va");
    setLastResponse("");
    try {
      // Send a properly formatted Nomba webhook to the gateway
      const payload = {
        event_type: "virtual_account.funded",
        requestId: `va_${Date.now()}`,
        data: {
          accountRef: `inv_test_${Date.now()}`,
          accountNumber: "8227727373",
          bankName: "Nombank MFB",
          accountName: "RailSwitch Test",
          amountReceived: 500000,
          amountExpected: 500000,
        },
      };

      // Compute HMAC
      const secret = "NombaHackathon2026";
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
      const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("http://localhost:8000/webhooks/nomba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "nomba-signature": sigHex },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      setLastResponse(`HTTP ${res.status}: ${text}`);
      addEvent("va.funded", `Nomba VA funded webhook sent — ${res.status}`, res.ok ? "success" : "error");
    } catch (err) {
      setLastResponse(String(err));
      addEvent("va.funded", `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleSimulateFailedCharge = async () => {
    setLoading("fail");
    setLastResponse("");
    try {
      const payload = {
        event_type: "payment_success",
        requestId: `pay_${Date.now()}`,
        data: {
          merchant: {
            merchantTxRef: `charge_${Date.now()}`,
            amount: 990000,
          },
          transaction: { status: "FAILED", responseCode: "51", message: "Insufficient funds" },
        },
      };

      const secret = "NombaHackathon2026";
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(JSON.stringify(payload)));
      const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("http://localhost:8000/webhooks/nomba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "nomba-signature": sigHex },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      setLastResponse(`HTTP ${res.status}: ${text}`);
      addEvent("charge.failed", `Failed charge webhook sent — ${res.status}`, res.ok ? "success" : "error");
    } catch (err) {
      setLastResponse(String(err));
      addEvent("charge.failed", `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sandbox Playground" description="Test RailSwitch payment rails and webhook events." />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <CreditCard className="size-4 text-indigo-500" /> Nomba Sandbox Test Cards
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEST_CARDS.map((card) => (
            <div key={card.outcome} className="rounded-lg border border-zinc-100 dark:border-zinc-800/60 p-3 flex flex-col gap-2">
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{card.label}</p>
              <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">{card.number}</p>
              <button
                onClick={() => handleSimulateCharge(card.outcome)}
                disabled={loading !== null}
                className="mt-1 h-7 px-3 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {loading === card.outcome ? "Running..." : "Test Flow"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Zap className="size-4 text-amber-500" /> Simulate Payment Rails (Real Nomba Webhooks)
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleSimulateVA} disabled={loading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shadow-sm">
            <Landmark className="size-3.5" />
            {loading === "va" ? "Sending..." : "Simulate VA Funded"}
          </button>
          <button onClick={handleSimulateFailedCharge} disabled={loading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 shadow-sm">
            <AlertTriangle className="size-3.5" />
            {loading === "fail" ? "Sending..." : "Simulate Failed Charge"}
          </button>
        </div>
        {lastResponse && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Last Response</p>
            <pre className="text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono max-h-40 overflow-auto">{lastResponse}</pre>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent Events</h3>
        {events.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 py-4 text-center">No events yet. Click a simulation button above.</p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const Icon = ev.status === "success" ? CheckCircle2 : ev.status === "error" ? XCircle : Clock;
              const color = ev.status === "success" ? "text-emerald-500" : ev.status === "error" ? "text-red-500" : "text-amber-500";
              return (
                <div key={ev.id} className="flex items-start gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                  <Icon className={`size-4 shrink-0 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{ev.event}</p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 font-mono">{ev.time}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{ev.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
