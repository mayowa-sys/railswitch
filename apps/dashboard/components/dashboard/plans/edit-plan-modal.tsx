"use client";

import { useState, useEffect } from "react";
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

interface EditPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  onSave?: (updated: Plan) => void;
}

export function EditPlanModal({ open, onOpenChange, plan, onSave }: EditPlanModalProps) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [price, setPrice] = useState(String(plan.price / 100));
  const [interval, setInterval] = useState<Plan["interval"]>(plan.interval);
  const [trialDays, setTrialDays] = useState(String(plan.trialDays));
  const [loading, setLoading] = useState(false);

  // Sync when plan prop changes
  useEffect(() => {
    // Intentional prop-to-state sync on plan change.
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(plan.name);
    setDescription(plan.description);
    setPrice(String(plan.price / 100));
    setInterval(plan.interval);
    /* eslint-enable react-hooks/set-state-in-effect */
    setTrialDays(String(plan.trialDays));
  }, [plan]);

  function handleSave() {
    setLoading(true);
    setTimeout(() => {
      onSave?.({
        ...plan,
        name: name.trim(),
        description: description.trim(),
        price: Math.round(Number(price) * 100),
        interval,
        trialDays: Number(trialDays) || 0,
      });
      setLoading(false);
    }, 600);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit: ${plan.name}`}
      description="Changes apply to new billing cycles only."
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0"
          >
            {loading ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-plan-name" className="text-xs font-semibold">Plan name</Label>
          <Input id="edit-plan-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-plan-desc" className="text-xs font-semibold">Description</Label>
          <textarea
            id="edit-plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:focus:border-indigo-500 resize-none text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-price" className="text-xs font-semibold">Price (₦)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₦</span>
              <Input id="edit-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 pl-7 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Billing interval</Label>
            <Select value={interval} onValueChange={(v) => { if (v) setInterval(v as Plan["interval"]); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-trial" className="text-xs font-semibold">Trial days</Label>
          <Input id="edit-trial" type="number" min="0" max="90" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
    </Modal>
  );
}
