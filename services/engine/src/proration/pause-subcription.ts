import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as ProrationHelper from "./proration-helper";
import { GlobalLogger } from "../utils/logger";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { CreditsTable } from "../schema/credits.schema";

const pauseLogger = new GlobalLogger("Proration-Pause");

/**
 * After the state machine has transitioned to paused (via the wrapper),
 * store the pause timestamp and bank any unused time as credits.
 * Called from the route handler after the wrapper's processEvent.
 */
export async function applyPauseAdjustments(
  subId: string,
  merchantId: string,
): Promise<void> {
  await db.execute(sql`SET LOCAL app.current_merchant_id=${merchantId}`);
  try {
    const sub = await ProrationHelper.getSubscription(subId);
    if (sub.state !== "paused") {
      throw new Error("Subscription must be in paused state to apply adjustments");
    }

    const unusedCredit = await ProrationHelper.getRemainingCredits(subId, sub.plan_id).catch(() => 0);

    await db
      .update(SubscriptionsTable)
      .set({ paused_at: new Date() })
      .where(eq(SubscriptionsTable.id, subId));

    if (unusedCredit > 0) {
      await db.insert(CreditsTable).values({
        amount: `${Math.round(unusedCredit * 100) / 100}`,
        merchant_id: merchantId,
        subscription_id: subId,
        source: "pause_credit",
      });
      pauseLogger.info("Pause credit banked", { subId, creditAmount: unusedCredit });
    }
  } catch (err) {
    if (err instanceof Error) {
      pauseLogger.error(
        "Error while applying pause adjustments",
        err.message,
      );
    }
    throw err;
  }
}
