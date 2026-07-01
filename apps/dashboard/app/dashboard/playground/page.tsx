"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  CreditCard,
  AlertTriangle,
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Zap,
} from "lucide-react";

const TEST_CARDS = [
  { label: "Success (Visa)", number: "4111 1111 1111 1111", outcome: "success" as const },
  { label: "Decline (Mastercard)", number: "5555 5555 5555 4444", outcome: "decline" as const },
  { label: "Insufficient Funds", number: "4000 0000 0000 0002", outcome: "insufficient" as const },
  { label: "3DS Challenge", number: "4000 0000 0000 3220", outcome: "3ds" as const },
];

interface StateEvent {
  id: string;
  event: string;
  detail: string;
  status: "success" | "error" | "pending";
  time: string;
}

export default function PlaygroundPage() {
  const [events, setEvents] = useState<StateEvent[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string>("");

  const addEvent = (event: string, detail: string, status: StateEvent["status"]) => {
    const ev: StateEvent = {
      id: Math.random().toString(36).slice(2, 8),
      event,
      detail,
      status,
      time: new Date().toLocaleTimeString("en-NG"),
    };
    setEvents((prev) => [ev, ...prev].slice(0, 20));
  };

  const handleSimulateCharge = async (outcome: string) => {
    setLoading(outcome);
    try {
      const res = await fetch("http://localhost:8000/v1/webhooks/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "charge.completed",
          card: TEST_CARDS.find((c) => c.outcome === outcome)?.number ?? "4111 1111 1111 1111",
          amount: 990000,
          outcome,
        }),
      });
      const text = await res.text();
      setLastResponse(text);
      addEvent("charge.simulated", `Simulated ${outcome} charge — ${res.status}`, "success");
    } catch (err) {
      addEvent("charge.simulated", `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleSimulateVA = async () => {
    setLoading("va");
    try {
      const res = await fetch("http://localhost:8000/v1/webhooks/virtual-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "virtual_account.funded",
          account: "9012345678",
          bank: "Wema Bank",
          amount: 7990000,
          reference: `va_trx_${Date.now()}`,
        }),
      });
      const text = await res.text();
      setLastResponse(text);
      addEvent("va.funded", `VA funded — ₦79,900.00 — ${res.status}`, "success");
    } catch (err) {
      addEvent("va.funded", `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading(null);
    }
  };

  const handleSimulateUSSD = async () => {
    setLoading("ussd");
    try {
      const res = await fetch("http://localhost:8000/v1/webhooks/ussd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "ussd.payment_authorized",
          phone: "+2348034125567",
          amount: 2990000,
        }),
      });
      const text = await res.text();
      setLastResponse(text);
      addEvent("ussd.authorized", `USSD payment authorized — ${res.status}`, "success");
    } catch (err) {
      addEvent("ussd.authorized", `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sandbox Playground"
        description="Test RailSwitch payment rails and webhook events."
      />

      {/* Test Cards */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <CreditCard className="size-4 text-indigo-500" />
          Test Cards
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEST_CARDS.map((card) => (
            <div
              key={card.outcome}
              className="rounded-lg border border-zinc-100 dark:border-zinc-800/60 p-3 flex flex-col gap-2"
            >
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{card.label}</p>
              <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">{card.number}</p>
              <button
                onClick={() => handleSimulateCharge(card.outcome)}
                disabled={loading !== null}
                className="mt-1 h-7 px-3 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
              >
                {loading === card.outcome ? "Charging..." : "Charge Card"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Rail Simulation Buttons */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Zap className="size-4 text-amber-500" />
          Simulate Payment Rails
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSimulateVA}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shadow-sm"
          >
            <Landmark className="size-3.5" />
            {loading === "va" ? "Processing..." : "Simulate VA Funded"}
          </button>
          <button
            onClick={handleSimulateUSSD}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-50 shadow-sm"
          >
            <Zap className="size-3.5" />
            {loading === "ussd" ? "Processing..." : "Simulate USSD Payment"}
          </button>
          <button
            onClick={() => handleSimulateCharge("decline")}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 shadow-sm"
          >
            <AlertTriangle className="size-3.5" />
            Simulate Failed Charge
          </button>
        </div>
        {lastResponse && (
          <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Last Response</p>
            <pre className="text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono">{lastResponse}</pre>
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Recent Events
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 py-4 text-center">
            No events yet. Click a simulation button above.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const Icon = ev.status === "success" ? CheckCircle2 : ev.status === "error" ? XCircle : Clock;
              const color = ev.status === "success" ? "text-emerald-500" : ev.status === "error" ? "text-red-500" : "text-amber-500";
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0"
                >
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
