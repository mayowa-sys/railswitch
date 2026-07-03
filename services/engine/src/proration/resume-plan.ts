import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as ProrationHelper from "./proration-helper";
import { GlobalLogger } from "../utils/logger";
import { PlansTable } from "../schema/plans.schema";
import { SubscriptionsTable } from "../schema/subscriptions.schema";

const resumeLogger = new GlobalLogger("Proration-Resume");

/**
 * After the state machine has transitioned to active (via the wrapper),
 * extend the next_billing_at by the pause duration so the customer
 * doesn't lose time they already paid for.
 * Called from the route handler after the wrapper's processEvent.
 */
export async function applyResumeAdjustments(
  subId: string,
  merchantId: string,
): Promise<void> {
  await db.execute(sql`SELECT set_config('app.current_merchant_id', ${merchantId}, true)`);

  try {
    const sub = await ProrationHelper.getSubscription(subId);
    if (sub.state !== "active") {
      throw new Error("Subscription must be in active state to apply resume adjustments");
    }
    if (!sub.paused_at) {
      resumeLogger.info("Subscription was not paused — no adjustments needed");
      return;
    }
    if (!sub.next_billing_at) {
      throw new Error("Subscription does not have next_billing_at property");
    }

    const [plan] = await db
      .select()
      .from(PlansTable)
      .where(eq(PlansTable.id, sub.plan_id));
    if (!plan) throw new Error(`Plan ${sub.plan_id} does not exist`);

    const pauseDuration = new Date().getTime() - sub.paused_at.getTime();
    const nextBillingAt = new Date(
      sub.next_billing_at.getTime() + pauseDuration,
    );

    await db
      .update(SubscriptionsTable)
      .set({
        next_billing_at: nextBillingAt,
        current_period_end: nextBillingAt,
        paused_at: null,
      })
      .where(eq(SubscriptionsTable.id, subId));

    resumeLogger.info("Resume adjustments applied", {
      subId,
      pauseDurationMs: pauseDuration,
      newNextBilling: nextBillingAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Error) {
      resumeLogger.error("Error while applying resume adjustments", err.message);
    }
    throw err;
  }
}
