import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { CreditsTable } from "../schema/credits.schema";
import { PlansTable, type Plan } from "../schema/plans.schema";
import * as ProrationHelper from "../proration/proration-helper";
import { getNextBillingDate } from "../utils/interval_util";

interface LineItems {
    plan_name: string;
    plan_amount: number;
    plan_interval: string;
    plan_ends_at: Date;
}

interface InvoicePreview {
    immediate_charge: number;
    credit_applied: number;
    next_invoice_amount: number;
    invoice_date: Date;
    items: LineItems[];
}

export async function preview(subId: string, change: Plan): Promise<InvoicePreview> {
  const sub = await ProrationHelper.getSubscription(subId);
  if (!["active", "trialing", "paused"].includes(sub.state)) {
    // don't allow for plan change except in these states
    throw new Error("You can't change plan during this state");
  }

  const [currentPlan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, sub.plan_id));
  if (!currentPlan) throw new Error("Current Plan does not exist");
  const [newPlan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, change.id));
  if (!newPlan) throw new Error("New Plan does not exist");

  const unusedCredits = await ProrationHelper.getRemainingCredits(
    subId,
    sub.plan_id,
  );

  const partial_new_credits = await ProrationHelper.getRemainingCredits(
    subId,
    change.id,
  );
  let totalCharge = partial_new_credits - unusedCredits;
  let amountToCharge = 0;
  let creditApplied = unusedCredits;

  if (totalCharge <= 0) {
    creditApplied += totalCharge;
  } else if (totalCharge > 0) {
    // check if there's any available credit yet
    const availableCredits = await db
      .select()
      .from(CreditsTable)
      .where(
        and(
          eq(CreditsTable.subscription_id, subId),
          isNull(CreditsTable.consumed_at),
        ),
      );

    if (availableCredits.length > 0) {
      // apply the credits
      const result = await ProrationHelper.applyCreditsToCharge(
        totalCharge,
        availableCredits.map((credit) => ({
          id: credit.id,
          amount: credit.amount,
          amount_consumed: credit.amount_consumed,
        })),
      );
      amountToCharge = result.netCharge;
      creditApplied += result.creditApplied;
    }
  }

  return {
    immediate_charge: amountToCharge, 
    credit_applied: creditApplied, 
    next_invoice_amount:change.amount, 
    invoice_date: new Date(), 
    items: [
        {
            plan_name: change.name, 
            plan_amount: Number(change.amount), 
            plan_interval: change.interval, 
            plan_ends_at: (getNextBillingDate(new Date(), change.interval, change.interval_count))
        }
    ]
  }
}
