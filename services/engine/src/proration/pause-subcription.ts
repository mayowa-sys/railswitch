import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import * as ProrationHelper from "./proration-helper";
import { SubscriptionWrapper } from "../wrapper/subscription-wrapper";
import { GlobalLogger } from "../utils/logger";
import { SubscriptionsTable } from "../schema/subscriptions.schema";

const pauseLogger = new GlobalLogger("Proration-Pause");

export async function pauseSubscription(
  subId: string,
  merchantId: string,
  wrapper: SubscriptionWrapper,
): Promise<void> {
  await db.execute(sql`SET LOCAL app.current.merchant_id=${merchantId}`);
  try {
    const sub = await ProrationHelper.getSubscription(subId);
    if (sub.state === "paused") return;
    else if (sub.state !== "active") {
      pauseLogger.error("You can't pause from this state");
      throw new Error("You can't pause from this state");
    }

    await wrapper.processEvent({
      subscriptionId: subId,
      event: { type: "PAUSE_REQUESTED", actor: "customer" },
      idempotencyKey: "idem",
    });

    await db
      .update(SubscriptionsTable)
      .set({ paused_at: new Date() })
      .where(eq(SubscriptionsTable.id, subId));

    return;
  } catch (err) {
    if (err instanceof Error) {
      pauseLogger.error(
        "Error while trying to pause subscription",
        err.message,
      );
    }
    throw err;
  }
}
