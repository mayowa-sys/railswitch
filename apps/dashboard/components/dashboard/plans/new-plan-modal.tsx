"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Plan } from "@/lib/mock-data";

interface NewPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate?: (plan: Plan) => void;
}

function generateId() {
  return "plan_" + Math.random().toString(36).slice(2, 9);
}

export function NewPlanModal({ open, onOpenChange, onCreate }: NewPlanModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [interval, setInterval] = useState("monthly");
  const [trialDays, setTrialDays] = useState("0");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Plan name is required.";
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
      e.price = "Enter a valid price in Naira.";
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setTimeout(() => {
      const newPlan: Plan = {
        id: generateId(),
        name: name.trim(),
        description: description.trim(),
        price: Math.round(Number(price) * 100),
        interval: interval as Plan["interval"],
        trialDays: Number(trialDays) || 0,
        status: "active",
        subscriberCount: 0,
        createdAt: new Date().toISOString(),
      };
      onCreate?.(newPlan);
      setLoading(false);
      onOpenChange(false);
      // reset
      setName(""); setDescription(""); setPrice(""); setInterval("monthly"); setTrialDays("0");
    }, 700);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create new plan"
      description="Define pricing, billing interval and trial period."
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0"
          >
            {loading ? "Creating…" : "Create plan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="plan-name" className="text-xs font-semibold">Plan name</Label>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
            placeholder="e.g. Growth Plan"
            className="h-9 text-sm"
          />
          {errors.name && <p className="text-[11px] text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plan-desc" className="text-xs font-semibold">Description <span className="text-zinc-400 font-normal">(optional)</span></Label>
          <textarea
            id="plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe what's included…"
            rows={2}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:focus:border-indigo-500 resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-price" className="text-xs font-semibold">Price (₦)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₦</span>
              <Input
                id="plan-price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setErrors((prev) => ({ ...prev, price: "" })); }}
                placeholder="0"
                className="h-9 pl-7 text-sm"
              />
            </div>
            {errors.price && <p className="text-[11px] text-red-500">{errors.price}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Billing interval</Label>
            <Select value={interval} onValueChange={(v) => { if (v) setInterval(v); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="trial-days" className="text-xs font-semibold">Trial period (days)</Label>
          <Input
            id="trial-days"
            type="number"
            min="0"
            max="90"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="h-9 text-sm"
          />
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Set to 0 for no free trial.</p>
        </div>
      </div>
    </Modal>
  );
}
