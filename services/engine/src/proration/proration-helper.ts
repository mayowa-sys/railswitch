import Decimal from "decimal.js";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { createBillingHandler } from "../rails/billing-handler-dependencies";
import { nextRetryAt } from "../rails/retry-timing";
import { CreditsTable } from "../schema/credits.schema";
import { InvoicesTable } from "../schema/invoices.schema";
import { PaymentMethodsTable } from "../schema/payment_methods.schema";
import { PlansTable } from "../schema/plans.schema";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { DunningPolicy } from "../state-machines/subscription";
import { getNextBillingDate } from "../utils/interval_util";
import { BillingHelper } from "../workers/billing.worker";

export async function getRemainingCredits(subId: string, planId: string) {
  const [sub] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));
  if (!sub) throw new Error("Subscription does not exist");
  const [plan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, planId));
  if (!plan) throw new Error("Plan does not exist");

  const daysRemaining = Math.ceil(
    (sub.current_period_end.getTime() - new Date().getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const duration =
    (getNextBillingDate(
      new Date(),
      plan.interval,
      plan.interval_count,
    ).getTime() -
      new Date().getTime()) /
    (24 * 60 * 60 * 1000);
  const unusedCredits = daysRemaining * (plan.amount / duration);
  return unusedCredits;
}

/**
 * Applies available credits to reduce a charge amount.
 * Deducts credits from the charge and marks them as consumed.
 *
 * @param chargeAmount - The original charge amount
 * @param availableCredits - Array of credit records from the database
 * @returns Object containing netCharge (amount after credits) and consumedCredits (credit IDs used)
 */
export async function applyCreditsToCharge(
  chargeAmount: Decimal | number,
  availableCredits: Array<{
    id: string;
    amount: string;
    amount_consumed: string;
  }>,
) {
  const charge = new Decimal(chargeAmount);
  //   const consumedCredits: string[] = [];
  let remainingCharge = charge;

  for (const credit of availableCredits) {
    if (remainingCharge.isZero() || remainingCharge.isNegative()) {
      break;
    }

    const availableCredit = new Decimal(credit.amount).minus(
      credit.amount_consumed,
    );

    if (availableCredit.isPositive()) {
      const creditToApply = Decimal.min(availableCredit, remainingCharge);

      // increase amount_consumed
      await db
        .update(CreditsTable)
        .set({
          amount_consumed: new Decimal(credit.amount_consumed)
            .plus(creditToApply)
            .toString(),
        })
        .where(eq(CreditsTable.id, credit.id));

      remainingCharge = remainingCharge.minus(creditToApply);
      //   consumedCredits.push(credit.id);
    }
  }

  return {
    netCharge: remainingCharge.toNumber(),
    // consumedCredits,
    creditApplied: charge.minus(remainingCharge).toNumber(),
  };
}

async function getDefaultPaymentMethod(customerId: string) {
  const [defaultMethod] = await db
    .select()
    .from(PaymentMethodsTable)
    .where(
      and(
        eq(PaymentMethodsTable.customer_id, customerId),
        eq(PaymentMethodsTable.is_default, true),
      ),
    );
  if (!defaultMethod)
    throw new Error(
      `Default Payment Method for customer ${customerId} not found`,
    );
  return defaultMethod;
}

export async function getSubscription(subId: string) {
  const [sub] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));
  if (!sub) throw new Error("Subscription not found");
  return sub;
}

async function getPlan(id: string) {
  const [plan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, id));
  if (!plan) throw new Error("Plan does not exist");

  return plan;
}

async function handleFailedPlanChangeCharge(subId: string, invoiceId: string) {
  const [subscription] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));

  if (!subscription) return;

  const shouldRetry = subscription.retry_count < subscription.policy.maxRetries;

  // Use retry timing engine for smart scheduling
  const nextAttempt = nextRetryAt({
    currentTime: new Date(),
    retryCount: subscription.retry_count,
    policy: subscription.policy as DunningPolicy,
  });

  await db
    .update(InvoicesTable)
    .set({
      status: shouldRetry ? "pending_retry" : "uncollectible",
      next_attempt_at: nextAttempt,
    })
    .where(eq(InvoicesTable.id, invoiceId));

  await db
    .update(SubscriptionsTable)
    .set({ next_billing_at: null })
    .where(eq(SubscriptionsTable.id, subId));
}

export async function handlePayments(
  subId: string,
  merchantId: string,
  invoiceId: string,
  charge: number,
) {
  const sub = await getSubscription(subId);
  const defaultPaymentMethod = await getDefaultPaymentMethod(sub.customer_id);
  if (!defaultPaymentMethod) throw new Error("Payment method was not found");

  const billingHandler = createBillingHandler(merchantId);
  const billResult = await billingHandler.bill({
    // what happens to the state here?
    subscriptionId: subId,
    invoiceId,
    amount: charge,
    paymentMethodToken: defaultPaymentMethod.nomba_token,
    idempotencyKey: "idemKey",
  });

  if (billResult.status === "paid") {
    await BillingHelper.markInvoiceAsPaid(invoiceId, `${charge}`);
  } else if (billResult.status === "failed") {
    await handleFailedPlanChangeCharge(sub.id, invoiceId);
  }
}