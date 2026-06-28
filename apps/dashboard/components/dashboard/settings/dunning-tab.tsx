"use client";

import { useState, useRef } from "react";
import {
  DUNNING_POLICY,
  type DunningPolicy,
  type RailId,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Landmark,
  Hash,
  MessageCircle,
  GripVertical,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Rail metadata ─────────────────────────────────────────────────────────────

const RAIL_META: Record<RailId, { label: string; description: string; icon: React.ElementType }> = {
  card:            { label: "Card Charge",      description: "Direct card debit attempt",          icon: CreditCard },
  virtual_account: { label: "Virtual Account",  description: "Bank transfer via dedicated VA",     icon: Landmark },
  ussd:            { label: "USSD",             description: "Customer dials *737# to pay",         icon: Hash },
  whatsapp:        { label: "WhatsApp",         description: "Payment link sent via WhatsApp",     icon: MessageCircle },
};

// ─── Interval preset metadata ──────────────────────────────────────────────────

const INTERVAL_PRESETS: Record<DunningPolicy["intervalPreset"], { label: string; description: string; intervals: string }> = {
  aggressive: { label: "Aggressive",  description: "Retry rapidly to maximise recovery speed",  intervals: "1d → 3d → 5d" },
  balanced:   { label: "Balanced",    description: "Balanced recovery with minimal customer friction", intervals: "3d → 7d → 14d" },
  gentle:     { label: "Gentle",      description: "Slower retries that reduce card-decline fatigue", intervals: "7d → 14d → 30d" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
      {children}
    </p>
  );
}

function FieldCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5", className)}>
      {children}
    </div>
  );
}

// ─── Rail toggle ───────────────────────────────────────────────────────────────

function RailToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
        enabled ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DunningTab() {
  const [policy, setPolicy] = useState<DunningPolicy>({ ...DUNNING_POLICY, railOrder: [...DUNNING_POLICY.railOrder], railEnabled: { ...DUNNING_POLICY.railEnabled } });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // drag state
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  function update(patch: Partial<DunningPolicy>) {
    setPolicy((p) => ({ ...p, ...patch }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    setSaving(true);
    // Simulate gateway POST
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setDirty(false);
    }, 800);
  }

  // ── Drag-and-drop handlers ──
  function onDragStart(i: number) { dragIdx.current = i; }
  function onDragEnter(i: number) { dragOverIdx.current = i; }
  function onDragEnd() {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) { dragIdx.current = null; dragOverIdx.current = null; return; }
    const next = [...policy.railOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ railOrder: next });
    dragIdx.current = null;
    dragOverIdx.current = null;
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Retries slider ── */}
      <FieldCard>
        <SectionTitle>Card Retries</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              id="retries-slider"
              type="range"
              min={0}
              max={5}
              step={1}
              value={policy.retries}
              onChange={(e) => update({ retries: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between mt-1.5">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={cn("text-[10px] font-medium", n === policy.retries ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-600")}>{n}</span>
              ))}
            </div>
          </div>
          <div className="shrink-0 w-14 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{policy.retries}</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
          Number of automatic card retry attempts before moving to the next cascade step.
        </p>
      </FieldCard>

      {/* ── Retry interval preset ── */}
      <FieldCard>
        <SectionTitle>Retry Intervals</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(INTERVAL_PRESETS) as DunningPolicy["intervalPreset"][]).map((preset) => {
            const meta = INTERVAL_PRESETS[preset];
            const active = policy.intervalPreset === preset;
            return (
              <button
                key={preset}
                onClick={() => update({ intervalPreset: preset })}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-all duration-200",
                  active
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/20"
                )}
              >
                <p className={cn("text-sm font-semibold", active ? "text-indigo-700 dark:text-indigo-400" : "text-zinc-900 dark:text-zinc-100")}>{meta.label}</p>
                <p className={cn("text-[10px] font-mono mt-1", active ? "text-indigo-500 dark:text-indigo-500" : "text-zinc-400 dark:text-zinc-500")}>{meta.intervals}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 leading-tight">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </FieldCard>

      {/* ── Rail order + toggles ── */}
      <FieldCard>
        <SectionTitle>Recovery Rail Order</SectionTitle>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Drag to reorder. Disabled rails are skipped during cascade recovery.
        </p>
        <div className="space-y-2">
          {policy.railOrder.map((railId, idx) => {
            const meta = RAIL_META[railId];
            const Icon = meta.icon;
            const enabled = policy.railEnabled[railId];
            return (
              <div
                key={railId}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
                  enabled
                    ? "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0c0c0e]"
                    : "border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/40 opacity-60"
                )}
              >
                {/* Step index */}
                <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                  {idx + 1}
                </span>

                {/* Grip handle */}
                <GripVertical className="size-4 text-zinc-300 dark:text-zinc-600 shrink-0" />

                {/* Icon */}
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-indigo-600 dark:text-indigo-400" />
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{meta.label}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{meta.description}</p>
                </div>

                {/* Toggle */}
                <RailToggle
                  enabled={enabled}
                  onChange={(v) => update({ railEnabled: { ...policy.railEnabled, [railId]: v } })}
                />
              </div>
            );
          })}
        </div>
      </FieldCard>

      {/* ── Grace period ── */}
      <FieldCard>
        <SectionTitle>Grace Period Before Cancellation</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              id="grace-period"
              type="number"
              min={0}
              max={90}
              value={policy.gracePeriodDays}
              onChange={(e) => update({ gracePeriodDays: Math.min(90, Math.max(0, Number(e.target.value))) })}
              className="w-24 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 pr-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 text-center outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">days</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {policy.gracePeriodDays === 0
                ? "Cancel immediately after cascade exhaustion."
                : `Cancel subscription ${policy.gracePeriodDays} day${policy.gracePeriodDays !== 1 ? "s" : ""} after all cascade steps fail.`}
            </p>
          </div>
        </div>
      </FieldCard>

      {/* ── Save button ── */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-9 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold border-0 shadow-sm shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
          ) : (
            "Save changes"
          )}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in-0 slide-in-from-left-1 duration-300">
            <CheckCircle2 className="size-3.5" /> Dunning policy updated
          </span>
        )}
      </div>
    </div>
  );
}
