// services/engine/src/ai/churn-features.ts
//
// DB-facing feature extraction for churn scoring. Kept separate from
// churn-scoring.ts so the pure model stays testable without a live
// database.

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { ChargeAttempts } from '../schema/charge_attempts.schema.js';
import { cascadeDepthForState, scoreChurn, type ChurnFeatures, type ChurnScoreResult } from './churn-scoring.js';

/**
 * Build the churn feature vector for a single subscription. Requires the
 * merchant scope to be set on the connection (RLS). Returns null if the
 * subscription does not exist under this merchant.
 */
export async function buildChurnFeatures(
  merchantId: string,
  subscriptionId: string,
): Promise<{ features: ChurnFeatures; subscription: typeof SubscriptionsTable.$inferSelect } | null> {
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
  if (!sub) return null;

  const [plan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, sub.plan_id))
    .limit(1);

  // All charge attempts for this subscription's invoices, both cycles.
  const attempts = await db
    .select()
    .from(ChargeAttempts)
    .innerJoin(InvoicesTable, eq(InvoicesTable.id, ChargeAttempts.invoice_id))
    .where(
      and(
        eq(InvoicesTable.subscription_id, sub.id),
        eq(ChargeAttempts.merchant_id, merchantId),
      ),
    );

  let failedAttempts = 0;
  let successfulCharges = 0;
  let lastSuccessAt: Date | null = null;
  for (const row of attempts) {
    const rec = row.charge_attempts ?? row;
    const status = rec.status;
    if (status === 'success') {
      successfulCharges++;
      const at = rec.attempted_at;
      if (at && (!lastSuccessAt || at > lastSuccessAt)) lastSuccessAt = at;
    } else if (status === 'failed') {
      failedAttempts++;
    }
  }

  const now = new Date();
  const created = sub.created_at ?? now;
  const daysSinceSignup = daysBetween(created, now);
  // If we have a recorded successful charge, count days since it. Otherwise,
  // for an active/trialing subscription with no failures, treat it as recently
  // successful (0 days) rather than penalising for missing history — a fresh
  // subscription with no cascade activity is not a churn signal. For any sub
  // that has failed attempts, fall back to daysSinceSignup so the signal shows.
  const daysSinceLastSuccess = lastSuccessAt
    ? daysBetween(lastSuccessAt, now)
    : (failedAttempts === 0 ? 0 : daysSinceSignup);

  const features: ChurnFeatures = {
    failedAttempts,
    successfulCharges,
    daysSinceSignup,
    daysSinceLastSuccess,
    currentRetryCount: sub.retry_count ?? 0,
    cascadeStageDepth: cascadeDepthForState(sub.state),
    // Amounts are stored in kobo in the DB; the model weight is calibrated
    // to naira, so we divide here rather than at the model boundary.
    planPriceNaira: plan ? Number(plan.amount ?? 0) / 100 : 0,
    hasPaused: sub.paused_at ? 1 : 0,
    isPastDue: sub.state === 'past_due' ? 1 : 0,
  };
  return { features, subscription: sub };
}

export async function scoreSubscriptionChurn(
  merchantId: string,
  subscriptionId: string,
): Promise<(ChurnScoreResult & { features: ChurnFeatures }) | null> {
  const built = await buildChurnFeatures(merchantId, subscriptionId);
  if (!built) return null;
  const result = scoreChurn(built.features);
  return { ...result, features: built.features };
}

/**
 * Bulk score every subscription for a merchant. Executes one SQL scan and
 * scores in-memory, so it stays O(n) with no per-row round-trips.
 */
export async function scoreMerchantChurn(
  merchantId: string,
): Promise<Array<{ subscriptionId: string; risk: number; band: string }>> {
  const rows = await db.execute<{
    id: string;
    state: string;
    retry_count: number;
    created_at: Date;
    paused_at: Date | null;
    plan_amount: string | number | null;
    failed_attempts: string | number;
    successful_charges: string | number;
    last_success_at: Date | null;
  }>(sql`
    SELECT
      s.id,
      s.state,
      s.retry_count,
      s.created_at,
      s.paused_at,
      p.amount AS plan_amount,
      COALESCE(SUM(CASE WHEN ca.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_attempts,
      COALESCE(SUM(CASE WHEN ca.status = 'success' THEN 1 ELSE 0 END), 0) AS successful_charges,
      MAX(CASE WHEN ca.status = 'success' THEN ca.attempted_at END) AS last_success_at
    FROM subscriptions s
    LEFT JOIN plans p ON p.id = s.plan_id
    LEFT JOIN invoices i ON i.subscription_id = s.id
    LEFT JOIN charge_attempts ca ON ca.invoice_id = i.id AND ca.merchant_id = ${merchantId}
    WHERE s.merchant_id = ${merchantId}
    GROUP BY s.id, p.amount
  `);

  const list = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[]);
  const now = new Date();
  return (list as Array<Record<string, unknown>>).map(r => {
    const created = new Date(r.created_at as string | number | Date);
    const daysSinceSignup = daysBetween(created, now);
    const lastSuccess = r.last_success_at ? new Date(r.last_success_at as string | number | Date) : null;
    const failedAttempts = Number(r.failed_attempts) || 0;
    const daysSinceLastSuccess = lastSuccess
      ? daysBetween(lastSuccess, now)
      : (failedAttempts === 0 ? 0 : daysSinceSignup);
    const features: ChurnFeatures = {
      failedAttempts,
      successfulCharges: Number(r.successful_charges) || 0,
      daysSinceSignup,
      daysSinceLastSuccess,
      currentRetryCount: Number(r.retry_count) || 0,
      cascadeStageDepth: cascadeDepthForState(String(r.state)),
      planPriceNaira: (Number(r.plan_amount) || 0) / 100,
      hasPaused: r.paused_at ? 1 : 0,
      isPastDue: r.state === 'past_due' ? 1 : 0,
    };
    const scored = scoreChurn(features);
    return { subscriptionId: String(r.id), risk: scored.risk, band: scored.band };
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}
