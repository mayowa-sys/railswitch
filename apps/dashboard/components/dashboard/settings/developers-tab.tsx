"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Copy, Check, Trash2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiKey {
  id: string;
  label: string;
  type: "live" | "test";
  prefix: string;
  secret: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function generateKeyId() {
  return "key_" + Math.random().toString(36).slice(2, 9);
}

function generateSecret(type: "live" | "test"): string {
  const prefix = type === "live" ? "rs_live_" : "rs_test_";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const body = Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return prefix + body;
}

function getPrefix(secret: string): string {
  const match = secret.match(/^(rs_(?:live|test)_)([A-Za-z0-9]{6})/);
  return match ? match[1] + match[2] : secret.slice(0, 14);
}

// ─── Key row ───────────────────────────────────────────────────────────────────

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (id: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [revealedOnce, setRevealedOnce] = useState(apiKey.revoked);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  function reveal() {
    if (revealedOnce || apiKey.revoked) return;
    setRevealed(true);
    setRevealedOnce(true);
    setTimeout(() => setRevealed(false), 20000);
  }

  function copy() {
    navigator.clipboard.writeText(apiKey.secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const masked = apiKey.prefix + "••••••••••••••••••";

  return (
    <div className={cn("rounded-xl border p-4 transition-all duration-200", apiKey.revoked ? "border-zinc-100 bg-zinc-50/60 opacity-60" : "border-zinc-200 bg-white dark:bg-[#121215]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold", apiKey.revoked ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100")}>{apiKey.label}</p>
            {apiKey.revoked && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">Revoked</span>}
          </div>
          <code className="text-[11px] font-mono text-zinc-500 block truncate">{revealed ? apiKey.secret : masked}</code>
          <div className="flex items-center gap-3 text-[10px] text-zinc-400">
            <span>Created {relativeDate(apiKey.createdAt)}</span>
            {apiKey.lastUsedAt && <span>· Last used {relativeDate(apiKey.lastUsedAt)}</span>}
            {!apiKey.lastUsedAt && !apiKey.revoked && <span>· Never used</span>}
          </div>
        </div>
        {!apiKey.revoked && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={revealed ? () => setRevealed(false) : reveal} disabled={revealedOnce && !revealed} className={cn("h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1", revealedOnce && !revealed ? "border-zinc-100 text-zinc-300 cursor-default" : "border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50")}>
              {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {revealedOnce && !revealed ? "Revealed" : revealed ? "Hide" : "Reveal"}
            </button>
            {revealed && <button onClick={copy} className="h-7 w-7 rounded-lg border flex items-center justify-center text-zinc-500 hover:text-zinc-900" title="Copy">{copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}</button>}
            {!confirmRevoke ? (
              <button onClick={() => setConfirmRevoke(true)} className="h-7 w-7 rounded-lg border flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50" title="Revoke"><Trash2 className="size-3.5" /></button>
            ) : (
              <div className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                <span className="text-[10px] text-red-600 font-medium">Revoke?</span>
                <button onClick={() => { onRevoke(apiKey.id); setConfirmRevoke(false); }} className="text-[10px] font-bold text-red-600 hover:text-red-700 ml-1">Yes</button>
                <button onClick={() => setConfirmRevoke(false)} className="text-[10px] text-zinc-500 hover:text-zinc-700 ml-1">Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DevelopersTab() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>(() => {
    // Initialize with the user's actual API key
    if (user?.apiKey) {
      return [{
        id: "key_demo",
        label: "Default",
        type: "test",
        prefix: getPrefix(user.apiKey),
        secret: user.apiKey,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        revoked: false,
      }];
    }
    return [];
  });

  function addKey(type: "live" | "test", label: string) {
    const secret = generateSecret(type);
    const newKey: ApiKey = {
      id: generateKeyId(),
      label,
      type,
      prefix: getPrefix(secret),
      secret,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revoked: false,
    };
    setKeys((prev) => [newKey, ...prev]);
  }

  function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, revoked: true } : k));
  }

  const liveKeys = keys.filter((k) => k.type === "live");
  const testKeys = keys.filter((k) => k.type === "test");

  return (
    <div className="space-y-10 max-w-2xl">
      {(["live", "test"] as const).map((type) => {
        const isLive = type === "live";
        const typeKeys = isLive ? liveKeys : testKeys;
        const [createOpen, setCreateOpen] = useState(false);
        const [label, setLabel] = useState("");

        return (
          <section key={type} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn("size-7 rounded-lg flex items-center justify-center", isLive ? "bg-indigo-50" : "bg-zinc-100")}>
                  <ShieldCheck className={cn("size-3.5", isLive ? "text-indigo-600" : "text-zinc-500")} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{isLive ? "Live" : "Test"} keys</p>
                  <p className="text-[11px] text-zinc-400">{isLive ? "Charge real money. Never expose publicly." : "Safe for development and CI pipelines."}</p>
                </div>
              </div>
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"><Plus className="size-3.5" /> Create key</button>
            </div>

            {createOpen && (
              <div className="rounded-xl border border-indigo-300/60 bg-indigo-50/30 p-4 space-y-3">
                <p className="text-xs font-semibold">Create {isLive ? "live" : "test"} key</p>
                <div className="flex items-center gap-2">
                  <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Key label" className="flex-1 h-9 rounded-lg border bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                  <button onClick={() => { if (label.trim()) { addKey(type, label.trim()); setLabel(""); setCreateOpen(false); } }} className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">Create</button>
                  <button onClick={() => { setCreateOpen(false); setLabel(""); }} className="h-9 px-3 rounded-lg border text-sm hover:bg-zinc-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {typeKeys.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center"><p className="text-sm text-zinc-400">No {isLive ? "live" : "test"} keys yet</p></div>}
              {typeKeys.map((k) => <ApiKeyRow key={k.id} apiKey={k} onRevoke={revokeKey} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
