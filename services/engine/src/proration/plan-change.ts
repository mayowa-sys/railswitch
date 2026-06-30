import Decimal from "decimal.js";
import { db } from "../db/client";
import { PlansTable, type Plan } from "../schema/plans.schema";
import { and, eq, isNull } from "drizzle-orm";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { sql } from "drizzle-orm";
import { CreditsTable } from "../schema/credits.schema";
import { InvoicesTable } from "../schema/invoices.schema";
import * as ProrationHelper from "./proration-helper";
import { BillingHandler } from "../rails/billing-handler";

export interface AvailableCredit {
  id: string;
  amount: string;
  amount_consumed: string;
}

export interface PlanChangeInputs {
  subscriptionId: string;
  subscription: Awaited<ReturnType<typeof ProrationHelper.getSubscription>>;
  currentPlan: Plan;
  newPlan: Plan;
  unusedCredits: number;
  partialNewCredits: number;
  totalCharge: number;
  availableCredits: AvailableCredit[];
}

export async function loadPlanChangeInputs(
  subscriptionId: string,
  currentPlanId: string,
  newPlanId: string,
): Promise<PlanChangeInputs> {
  const sub = await ProrationHelper.getSubscription(subscriptionId);
  if (!["active", "trialing", "paused"].includes(sub.state)) {
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

  const partialNewCredits = await ProrationHelper.getRemainingCredits(
    subscriptionId,
    newPlanId,
  );

  const totalCharge = partialNewCredits - unusedCredits;

  const availableCredits: AvailableCredit[] =
    totalCharge > 0
      ? await db
          .select()
          .from(CreditsTable)
          .where(
            and(
              eq(CreditsTable.subscription_id, subscriptionId),
              isNull(CreditsTable.consumed_at),
            ),
          )
      : [];

  return {
    subscriptionId,
    subscription: sub,
    currentPlan,
    newPlan,
    unusedCredits,
    partialNewCredits,
    totalCharge,
    availableCredits,
  };
}

export function estimateCreditApplication(
  totalCharge: number,
  availableCredits: AvailableCredit[],
) {
  const charge = new Decimal(totalCharge);
  let remaining = charge;
  let creditApplied = new Decimal(0);

  for (const credit of availableCredits) {
    if (remaining.lte(0)) break;

    const availableAmount = new Decimal(credit.amount).minus(
      credit.amount_consumed,
    );

    if (availableAmount.lte(0)) continue;

    const applied = Decimal.min(availableAmount, remaining);
    remaining = remaining.minus(applied);
    creditApplied = creditApplied.plus(applied);
  }

  return {
    netCharge: remaining.toNumber(),
    creditApplied: creditApplied.toNumber(),
  };
}

// TODO: add transactions...
export async function handlePlanChange(
  subscriptionId: string,
  currentPlanId: string,
  newPlanId: string,
  merchantId: string,
  billingHandler: BillingHandler,
  idempotencyKey: string,
) {
  if (currentPlanId.trim() === newPlanId.trim()) {
    throw new Error("Current Plan and New Plan cannot be the same");
  }

  db.execute(sql`SET LOCAL app.current.merchant_id=${merchantId}`);

  const inputs = await loadPlanChangeInputs(
    subscriptionId,
    currentPlanId,
    newPlanId,
  );

  if (inputs.totalCharge <= 0) {
    await db.insert(CreditsTable).values({
      amount: `${-1 * inputs.totalCharge}`,
      merchant_id: merchantId,
      subscription_id: subscriptionId,
      source: "downgrade",
    });

    await db.update(SubscriptionsTable).set({ plan_id: newPlanId });
    return;
  }

  let amountToCharge = inputs.totalCharge;

  if (inputs.availableCredits.length > 0) {
    const result = await ProrationHelper.applyCreditsToCharge(
      inputs.totalCharge,
      inputs.availableCredits,
    );
    amountToCharge = result.netCharge;

    if (amountToCharge <= 0) {
      await db.update(SubscriptionsTable).set({
        plan_id: newPlanId,
        retry_count: 0,
      });
      return;
    }
  }

  const [invoice] = await db
    .insert(InvoicesTable)
    .values({
      subscription_id: subscriptionId,
      merchant_id: merchantId,
      status: "open",
      amount: `${amountToCharge}`,
      metadata: {
        isCreditApplied: true,
        creditApplied: inputs.totalCharge - amountToCharge,
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
    billingHandler,
    idempotencyKey,
  );
}
