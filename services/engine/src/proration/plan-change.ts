import { db } from "../db/client";
import { PlansTable } from "../schema/plans.schema";
import { and, eq, isNull } from "drizzle-orm";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { sql } from "drizzle-orm";
import { CreditsTable } from "../schema/credits.schema";
import { InvoicesTable } from "../schema/invoices.schema";
import * as ProrationHelper from "./proration-helper";
import { BillingHandler } from "../rails/billing-handler";

// TODO: add transactions...
export async function handlePlanChange(
  subscriptionId: string,
  currentPlanId: string,
  newPlanId: string,
  merchantId: string,
  billingHandler: BillingHandler
) {
  if (currentPlanId.trim() === newPlanId.trim()) {
    throw new Error("Current Plan and New Plan cannot be the same");
  }

  db.execute(sql`SET LOCAL app.current.merchant_id=${merchantId}`);

  const sub = await ProrationHelper.getSubscription(subscriptionId);
  if (!["active", "trialing", "paused"].includes(sub.state)) {
    // don't allow for plan change except in these states
    throw new Error("You can't change plan during this state");
  }

  const [currentPlan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, currentPlanId));
  if (!currentPlan) throw new Error("Current Plan does not exist");
  const [newPlan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, newPlanId));
  if (!newPlan) throw new Error("New Plan does not exist");

  const unusedCredits = await ProrationHelper.getRemainingCredits(
    subscriptionId,
    currentPlanId,
  );

  const partial_new_credits = await ProrationHelper.getRemainingCredits(
    subscriptionId,
    newPlanId,
  );
  const totalCharge = partial_new_credits - unusedCredits;
  let amountToCharge = 0;

  if (totalCharge <= 0) {
    // merchant owes customer, store credits
    await db.insert(CreditsTable).values({
      amount: `${-1 * totalCharge}`,
      merchant_id: merchantId,
      subscription_id: subscriptionId,
      source: "downgrade",
    });

    await db.update(SubscriptionsTable).set({ plan_id: newPlanId });
    return;
  } else if (totalCharge > 0) {
    // check if there's any available credit yet
    const availableCredits = await db
      .select()
      .from(CreditsTable)
      .where(
        and(
          eq(CreditsTable.subscription_id, subscriptionId),
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
      if (amountToCharge <= 0) {
        // plan has been paid in full by credits...
        await db.update(SubscriptionsTable).set({
          plan_id: newPlanId,
          retry_count: 0,
        });
        return;
      }
    }
  }

  // create invoice
  const [invoice] = await db
    .insert(InvoicesTable)
    .values({
      subscription_id: subscriptionId,
      merchant_id: merchantId,
      status: "open",
      amount: `${amountToCharge}`,
      metadata: {
        isCreditApplied: true,
        creditApplied: totalCharge - amountToCharge,
      },
      currency: "NGN",
      description: "Invoice Charge for plan change",
      due_date: new Date(),
    })
    .returning();
  if (!invoice) throw new Error("Invoice could not be created. Try later");

  // update the subscription
  await db.update(SubscriptionsTable).set({
    current_invoice_id: invoice.id,
    plan_id: newPlanId,
    retry_count: 0,
  });

  await ProrationHelper.handlePayments(
    subscriptionId,
    invoice.id,
    amountToCharge,
    billingHandler
  );
}
