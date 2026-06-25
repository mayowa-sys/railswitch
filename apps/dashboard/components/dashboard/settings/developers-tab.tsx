"use client";

import { useState } from "react";
import {
  API_KEYS,
  type ApiKey,
  type ApiKeyType,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function generateKeyId() {
  return "key_" + Math.random().toString(36).slice(2, 9);
}

function generateSecret(type: ApiKeyType): string {
function getPrefix(secret: string): string {
  // Match "rs_live_" or "rs_test_" then first 6 chars of the random body
  const match = secret.match(/^(rs_(?:live|test)_)([A-Za-z0-9]{6})/);
  return match ? match[1] + match[2] : secret.slice(0, 14);
}
}

function getPrefix(secret: string) {
  const parts = secret.split("_");
  return parts.slice(0, 3).join("_") + "_" + secret.slice(parts.slice(0, 3).join("_").length + 1, parts.slice(0, 3).join("_").length + 7);
}

// ─── Key row ───────────────────────────────────────────────────────────────────

type KeyRowState = {
  revealed: boolean;
  revealedOnce: boolean;
  copied: boolean;
  revoking: boolean;
  revoked: boolean;
};

function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const [state, setState] = useState<KeyRowState>({
    revealed: false,
    revealedOnce: apiKey.revoked,
    copied: false,
    revoking: false,
    revoked: apiKey.revoked,
  });
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  function reveal() {
    if (state.revealedOnce || state.revoked) return;
    setState((s) => ({ ...s, revealed: true, revealedOnce: true }));
    // Auto-mask after 20s
    setTimeout(() => setState((s) => ({ ...s, revealed: false })), 20000);
  }

  function hide() {
    setState((s) => ({ ...s, revealed: false }));
  }

  function copy() {
    navigator.clipboard.writeText(apiKey.secret).catch(() => {});
    setState((s) => ({ ...s, copied: true }));
    setTimeout(() => setState((s) => ({ ...s, copied: false })), 2000);
  }

  function revoke() {
    setState((s) => ({ ...s, revoking: true }));
    setTimeout(() => {
      setState((s) => ({ ...s, revoking: false, revoked: true }));
      setConfirmRevoke(false);
    }, 700);
  }

  const masked = apiKey.prefix + "••••••••••••••••••••••••••••••••••";

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all duration-200",
      state.revoked
        ? "border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/60 dark:bg-zinc-900/30 opacity-60"
        : "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215]"
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: label + metadata */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-sm font-semibold", state.revoked ? "line-through text-zinc-400 dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-100")}>
              {apiKey.label}
            </p>
            {state.revoked && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60">
                Revoked
              </span>
            )}
          </div>

          {/* Key display */}
          <code className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 block truncate">
            {state.revealed ? apiKey.secret : masked}
          </code>

          {/* Dates */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-500">
            <span>Created {relativeDate(apiKey.createdAt)}</span>
            {apiKey.lastUsedAt && <span>· Last used {relativeDate(apiKey.lastUsedAt)}</span>}
            {!apiKey.lastUsedAt && !state.revoked && <span>· Never used</span>}
          </div>
        </div>

        {/* Right: actions */}
        {!state.revoked && (
          <div className="flex items-center gap-1 shrink-0">
            {/* Reveal / hide */}
            <button
              onClick={state.revealed ? hide : reveal}
              disabled={state.revealedOnce && !state.revealed}
              title={state.revealedOnce && !state.revealed ? "Already revealed — create a new key to get a fresh secret" : state.revealed ? "Hide" : "Reveal"}
              className={cn(
                "h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1",
                state.revealedOnce && !state.revealed
                  ? "border-zinc-100 dark:border-zinc-800 text-zinc-300 dark:text-zinc-600 cursor-default"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              )}
            >
              {state.revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {state.revealedOnce && !state.revealed ? "Revealed" : state.revealed ? "Hide" : "Reveal"}
            </button>

            {/* Copy */}
            {state.revealed && (
              <button
                onClick={copy}
                className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                title="Copy"
              >
                {state.copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              </button>
            )}

            {/* Revoke */}
            {!confirmRevoke ? (
              <button
                onClick={() => setConfirmRevoke(true)}
                className="h-7 w-7 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                title="Revoke key"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/20 px-2 py-1">
                <AlertTriangle className="size-3 text-red-500 shrink-0" />
                <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Revoke?</span>
                <button
                  onClick={revoke}
                  disabled={state.revoking}
                  className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 ml-1"
                >
                  {state.revoking ? <Loader2 className="size-3 animate-spin" /> : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmRevoke(false)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 ml-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create key modal ──────────────────────────────────────────────────────────

function CreateKeyModal({
  open,
  type,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  type: ApiKeyType;
  onOpenChange: (v: boolean) => void;
  onCreate: (key: ApiKey) => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    if (!label.trim()) { setError("A label is required."); return; }
    setCreating(true);
    setTimeout(() => {
      const secret = generateSecret(type);
      const newKey: ApiKey = {
        id: generateKeyId(),
        label: label.trim(),
        type,
        prefix: getPrefix(secret),
        secret,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        revoked: false,
      };
      onCreate(newKey);
      setCreating(false);
      onOpenChange(false);
      setLabel("");
    }, 700);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) { setLabel(""); setError(""); } }}
      title={`Create ${type === "live" ? "live" : "test"} API key`}
      description={`This ${type} key will be revealed once. Store it securely — you won't be able to see it again.`}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 p-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0"
          >
            {creating ? <><Loader2 className="size-3 animate-spin" /> Creating…</> : "Create key"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Key label</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Production server"
            className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 p-3 flex items-start gap-2">
          <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            The secret will be shown <strong>once</strong> immediately after creation and masked permanently after 20 seconds.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Key section (live / test) ─────────────────────────────────────────────────

function KeySection({ type, keys, onCreate }: { type: ApiKeyType; keys: ApiKey[]; onCreate: (k: ApiKey) => void }) {
  const [createOpen, setCreateOpen] = useState(false);

  const isLive = type === "live";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "size-7 rounded-lg flex items-center justify-center",
            isLive ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-zinc-100 dark:bg-zinc-800/60"
          )}>
            <ShieldCheck className={cn("size-3.5", isLive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400")} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {isLive ? "Live" : "Test"} keys
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {isLive ? "Charge real money. Never expose publicly." : "Safe for development and CI pipelines."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <Plus className="size-3.5" /> Create key
        </button>
      </div>

      <div className="space-y-2">
        {keys.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No {isLive ? "live" : "test"} keys yet</p>
          </div>
        )}
        {keys.map((k) => <ApiKeyRow key={k.id} apiKey={k} />)}
      </div>

      <CreateKeyModal
        open={createOpen}
        type={type}
        onOpenChange={setCreateOpen}
        onCreate={(k) => { onCreate(k); setCreateOpen(false); }}
      />
    </section>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DevelopersTab() {
  const [keys, setKeys] = useState<ApiKey[]>(API_KEYS);

  function addKey(key: ApiKey) {
    setKeys((prev) => [key, ...prev]);
  }

  const liveKeys = keys.filter((k) => k.type === "live");
  const testKeys = keys.filter((k) => k.type === "test");

  return (
    <div className="space-y-10 max-w-2xl">
      <KeySection type="live" keys={liveKeys} onCreate={addKey} />
      <div className="border-t border-zinc-100 dark:border-zinc-800/60" />
      <KeySection type="test" keys={testKeys} onCreate={addKey} />
    </div>
  );
}
