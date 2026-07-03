import { db } from "../db/client.js";
import { PlansTable } from "../schema/plans.schema.js";
import { SubscriptionsTable } from "../schema/subscriptions.schema.js";
import { eq, and } from "drizzle-orm";
import { loadPlanChangeInputs, estimateCreditApplication } from "../proration/plan-change.js";

export interface LineItem {
  plan_name: string;
  plan_amount: number;
  plan_interval: string;
}

export interface InvoicePreview {
  immediate_charge: number;
  credit_applied: number;
  unused_credit: number;
  net_amount: number;
  next_invoice_amount: number;
  invoice_date: Date;
  items: LineItem[];
  currency: string;
}

/**
 * Computes a prorated invoice preview for a plan change or trial conversion.
 * Does NOT mutate any state — safe to call repeatedly.
 */
export async function preview(
  subscriptionId: string,
  newPlanId: string,
  merchantId: string,
): Promise<InvoicePreview> {
  const [sub] = await db
    .select()
    .from(SubscriptionsTable)
    .where(
      and(
        eq(SubscriptionsTable.id, subscriptionId),
        eq(SubscriptionsTable.merchant_id, merchantId),
      ),
    )
    .limit(1);

  if (!sub) throw new Error("Subscription not found");

  const [newPlan] = await db
    .select()
    .from(PlansTable)
    .where(
      and(
        eq(PlansTable.id, newPlanId),
        eq(PlansTable.merchant_id, merchantId),
      ),
    )
    .limit(1);

  if (!newPlan) throw new Error("New plan not found");

  const [currentPlan] = await db
    .select()
    .from(PlansTable)
    .where(
      and(
        eq(PlansTable.id, sub.plan_id),
        eq(PlansTable.merchant_id, merchantId),
      ),
    )
    .limit(1);

  if (!currentPlan) throw new Error("Current plan not found");

  const inputs = await loadPlanChangeInputs(
    subscriptionId,
    currentPlan.id,
    newPlanId,
  );

  let immediateCharge = 0;
  let creditApplied = inputs.unusedCredits;

  if (inputs.totalCharge <= 0) {
    creditApplied += Math.abs(inputs.totalCharge);
  } else if (inputs.availableCredits.length > 0) {
    const result = estimateCreditApplication(
      inputs.totalCharge,
      inputs.availableCredits,
    );
    immediateCharge = result.netCharge;
    creditApplied += result.creditApplied;
  } else {
    immediateCharge = inputs.totalCharge;
  }

  const netAmount = Math.max(0, immediateCharge - inputs.unusedCredits);

  return {
    immediate_charge: Math.round(immediateCharge * 100) / 100,
    credit_applied: Math.round(creditApplied * 100) / 100,
    unused_credit: Math.round(inputs.unusedCredits * 100) / 100,
    net_amount: Math.round(netAmount * 100) / 100,
    next_invoice_amount: Number(newPlan.amount),
    invoice_date: new Date(),
    items: [
      {
        plan_name: currentPlan.name,
        plan_amount: Number(currentPlan.amount),
        plan_interval: currentPlan.interval,
      },
      {
        plan_name: newPlan.name,
        plan_amount: Number(newPlan.amount),
        plan_interval: newPlan.interval,
      },
    ],
    currency: newPlan.currency,
  };
}
