"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";

interface WebhookEndpoint {
  id: string;
  url: string;
  is_active: boolean;
  subscriptions: string[];
  created_at: string;
}

interface WebhookEvent {
  id: string;
  event_type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export default function WebhooksPage() {
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) return;

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    Promise.all([
      fetch(`${API}/v1/webhooks/management/endpoints`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json()),
      fetch(`${API}/v1/webhooks/management/events?limit=50`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json()),
    ]).then(([eps, evts]) => {
      setEndpoints(eps.data ?? []);
      setEvents(evts.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  const EVENT_TYPES = [
    "subscription.created", "subscription.active", "subscription.cancelled",
    "payment.succeeded", "payment.failed", "payment.recovered",
    "cascade.retrying", "cascade.va_fallback", "cascade.whatsapp_fallback", "cascade.past_due", "cascade.recovered",
  ];

  const addEndpoint = async () => {
    if (!newUrl || !user?.apiKey) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    await fetch(`${API}/v1/webhooks/management/endpoints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl, subscriptions: newEvents }),
    });
    setNewUrl("");
    setNewEvents([]);
    window.location.reload();
  };

  const toggleEndpoint = async (id: string, isActive: boolean) => {
    if (!user?.apiKey) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    await fetch(`${API}/v1/webhooks/management/endpoints/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${user.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    setEndpoints(endpoints.map(e => e.id === id ? { ...e, is_active: !isActive } : e));
  };

  const deleteEndpoint = async (id: string) => {
    if (!user?.apiKey || !confirm("Delete this webhook endpoint?")) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    await fetch(`${API}/v1/webhooks/management/endpoints/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${user.apiKey}` },
    });
    setEndpoints(endpoints.filter(e => e.id !== id));
  };

  const testEndpoint = async (id: string) => {
    if (!user?.apiKey) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    await fetch(`${API}/v1/webhooks/management/endpoints/${id}/test`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.apiKey}` },
    });
    alert("Test event sent!");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Manage webhook endpoints and view delivery logs." />

      {/* Add Endpoint */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Add Endpoint</h3>
        <div className="flex gap-3 mb-3">
          <input
            type="url"
            placeholder="https://your-server.com/webhook"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
          />
          <button
            onClick={addEndpoint}
            disabled={!newUrl}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((et) => (
            <label key={et} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <input
                type="checkbox"
                checked={newEvents.includes(et)}
                onChange={(e) => setNewEvents(e.target.checked ? [...newEvents, et] : newEvents.filter(x => x !== et))}
                className="rounded"
              />
              {et}
            </label>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <h3 className="text-sm font-semibold">Endpoints</h3>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-400">Loading...</div>
        ) : endpoints.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-400">No webhook endpoints configured.</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {endpoints.map((ep) => (
              <div key={ep.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${ep.is_active ? "bg-emerald-500" : "bg-zinc-300"}`} />
                    <span className="text-sm font-mono truncate">{ep.url}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {ep.subscriptions.length > 0 ? ep.subscriptions.join(", ") : "All events"}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => testEndpoint(ep.id)} className="text-[11px] text-indigo-600 hover:underline">Test</button>
                  <button onClick={() => toggleEndpoint(ep.id, ep.is_active)} className="text-[11px] text-zinc-500 hover:underline">
                    {ep.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => deleteEndpoint(ep.id)} className="text-[11px] text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Log */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <h3 className="text-sm font-semibold">Recent Deliveries</h3>
        </div>
        {events.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-400">No events recorded yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {events.map((evt) => (
              <div key={evt.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    evt.status === "delivered" ? "bg-emerald-50 text-emerald-700" :
                    evt.status === "failed" ? "bg-red-50 text-red-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {evt.status}
                  </span>
                  <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">{evt.event_type}</span>
                </div>
                <span className="text-[11px] text-zinc-400">{new Date(evt.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
