import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as ProrationHelper from "./proration-helper";
import { GlobalLogger } from "../utils/logger";
import { PlansTable } from "../schema/plans.schema";
import { SubscriptionWrapper } from "../wrapper/subscription-wrapper";
import { SubscriptionsTable } from "../schema/subscriptions.schema";

const resumeLogger = new GlobalLogger("Proration-Resume");

export async function resumeSubscription(subId: string, merchantId: string, wrapper: SubscriptionWrapper) {
  await db.execute(sql`SET LOCAL app.current.merchant_id=${merchantId}`);

  try {
    const sub = await ProrationHelper.getSubscription(subId);
    if (!sub.paused_at) {
      resumeLogger.info("Subscription was not paused");
      return;
    }
    if (!sub.next_billing_at) {
      throw new Error("Subscription does not have next_billing_at property");
    }

    const [plan] = await db
      .select()
      .from(PlansTable)
      .where(eq(PlansTable.id, sub.plan_id));
    if (!plan) throw new Error(`This ${sub.plan_id} plan does not exist`);


    wrapper.processEvent({
      subscriptionId: subId,
      idempotencyKey: "idemKey",
      event: { type: "RESUME_REQUESTED", actor: "customer" },
    });

    const pause_duration = new Date().getTime() - sub.paused_at.getTime();
    const nextBillingAt = new Date(
      sub.next_billing_at?.getTime() + pause_duration,
    );

    // updated the subscription helper
    await db
      .update(SubscriptionsTable)
      .set({
        next_billing_at: nextBillingAt,
        current_period_end: nextBillingAt,
      })
      .where(eq(SubscriptionsTable.id, subId));
  } catch (err) {
    if (err instanceof Error) {
      resumeLogger.error("Error while resuming plan", err.message);
      resumeLogger.error(err);
    }
    throw err;
  }
}
