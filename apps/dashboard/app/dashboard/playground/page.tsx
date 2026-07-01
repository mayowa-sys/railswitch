"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  CreditCard, Landmark, MessageCircle, RefreshCw, Zap,
  CheckCircle2, XCircle, Clock, ArrowRight, Loader2,
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
};

const TEST_CARDS = [
  { label: "Success", number: "5060 6666 6666 6666 666", key: "success" },
  { label: "Insufficient", number: "5060 6666 6666 6666 674", key: "insufficient" },
];

export default function PlaygroundPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState("");
  const [response, setResponse] = useState("");

  const addLog = (event: string, detail: string, status: "success" | "error" = "success") => {
    setLogs((prev) => [{ id: Math.random().toString(36).slice(2, 8), event, detail, status, time: new Date().toLocaleTimeString("en-NG") }, ...prev].slice(0, 30));
  };

  const sendWebhook = async (eventType: string, data: Record<string, unknown>) => {
    setLoading(eventType);
    setResponse("");
    try {
      const secret = "NombaHackathon2026";
      const ts = String(Math.floor(Date.now() / 1000));
      const payload = { event_type: eventType, requestId: `wh_${Date.now()}`, data };
      const encoder = new TextEncoder();
      const body = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, body)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("http://localhost:8000/webhooks/nomba", {
        method: "POST",
        headers: { "Content-Type": "application/json", "nomba-signature": sig, "nomba-timestamp": ts, "nomba-signature-algorithm": "HmacSHA256" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      setResponse(`HTTP ${res.status}\n${text.slice(0, 300)}`);
      addLog(eventType, `HTTP ${res.status}`, res.ok ? "success" : "error");
    } catch (err) {
      setResponse(String(err));
      addLog(eventType, `Failed: ${err instanceof Error ? err.message : "Unknown"}`, "error");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Webhook Playground" description="Send real Nomba webhooks to test the cascade and event pipeline." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Simulate */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Test Cards</h3>
            <div className="grid gap-2">
              {TEST_CARDS.map((card) => (
                <div key={card.key} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{card.label}</p>
                    <p className="text-[11px] font-mono text-zinc-400">{card.number}</p>
                  </div>
                  <button onClick={() => sendWebhook("payment_success", { merchant: { merchantTxRef: `tx_${Date.now()}`, amount: 990000 }, transaction: { status: card.key === "success" ? "SUCCESS" : "FAILED", responseCode: card.key === "success" ? "00" : "51", message: card.key === "success" ? "Approved" : "Insufficient funds" } })}
                    disabled={loading !== ""} className="h-7 px-3 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors">
                    {loading === "payment_success" ? <Loader2 className="size-3 animate-spin" /> : "Charge Card"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Payment Rails</h3>
            <div className="grid gap-2">
              <button onClick={() => sendWebhook("virtual_account.funded", { accountRef: `inv_${Date.now()}`, accountNumber: "8227727373", bankName: "Nombank MFB", amountReceived: 500000, amountExpected: 500000 })}
                disabled={loading !== ""} className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors text-left w-full disabled:opacity-50">
                <Landmark className="size-5 text-emerald-600" />
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Virtual Account Funded</p><p className="text-[10px] text-zinc-500">Simulate customer transferring to a VA</p></div>
                {loading === "virtual_account.funded" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 text-zinc-400" />}
              </button>

              <button onClick={() => sendWebhook("payment_success", { merchant: { merchantTxRef: `tx_${Date.now()}`, amount: 2990000 }, transaction: { status: "FAILED", responseCode: "51", message: "Insufficient funds" } })}
                disabled={loading !== ""} className="flex items-center gap-3 p-3 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors text-left w-full disabled:opacity-50">
                <CreditCard className="size-5 text-red-600" />
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Charge Failed</p><p className="text-[10px] text-zinc-500">Simulate a declined card charge</p></div>
                {loading === "payment_success" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4 text-zinc-400" />}
              </button>
            </div>
          </div>

          {response && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 p-4">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Response</p>
              <pre className="text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono max-h-32 overflow-auto">{response}</pre>
            </div>
          )}
        </div>

        {/* Right: Event log */}
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
                <p className="text-[11px] text-zinc-400 mt-1">Click a webhook simulation to see the event pipeline in action.</p>
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
