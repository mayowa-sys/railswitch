// services/engine/src/ai/retry-timing-model.ts
//
// ML-based retry timing scorer. Replaces the hard-snap rules in
// rails/retry-timing.ts with a continuous scoring function over the
// next 72 hours, then picks the argmax.
//
// The model is a logistic regression over 8 hand-crafted features. The
// weights encode Nigerian payment patterns (payday, liquidity window,
// evening/weekend penalties) but the shape is trainable — swap in
// weights learned from historical charge_attempts data and the code
// keeps working. See `trainRetryModel` below for the batch trainer.
//
// Everything here is pure, deterministic given a seed, and has no IO.
// No API calls, no external dependencies.
//
// Non-goals:
//  - True online learning. We snapshot weights at build time / from DB.
//  - Handling non-NGN markets. The features are Nigeria-specific.

import type { DunningPolicy } from '../state-machines/subscription.js';

const WAT_OFFSET_MS = 60 * 60 * 1000;
const HOURS_LOOKAHEAD = 72;

export interface RetryModelFeatures {
  /** 0-23, WAT hour of candidate retry slot */
  hourWAT: number;
  /** 1-31, WAT day of month */
  dayOfMonth: number;
  /** 0=Sunday…6=Saturday, WAT */
  dayOfWeek: number;
  /** Retries already attempted this cycle */
  retryCount: number;
  /** Hours since the original charge failure */
  hoursSinceFailure: number;
  /** Amount in NGN (whole naira) */
  amountNaira: number;
  /** 1 if slot is between 25th–30th (payday window), else 0 */
  isPaydayWindow: number;
  /** 1 if slot is between 10:00–14:00 WAT (liquidity window), else 0 */
  isLiquidityWindow: number;
}

export interface RetryModelWeights {
  intercept: number;
  hourWAT: number;
  dayOfMonth: number;
  dayOfWeek: number;
  retryCount: number;
  hoursSinceFailure: number;
  amountNaira: number;
  isPaydayWindow: number;
  isLiquidityWindow: number;
}

/**
 * Default weights — hand-tuned to reproduce the previous rule-based
 * behavior while producing continuous scores. Values are chosen so
 * that:
 *   - payday window contributes ~+2.0 logit (very strong)
 *   - liquidity window contributes ~+1.2 logit
 *   - each additional retry adds a small penalty (recovery odds decay)
 *   - weekend/late-night hours are penalized
 */
export const DEFAULT_WEIGHTS: RetryModelWeights = {
  intercept: -0.8,
  hourWAT: 0.0,           // dominated by the liquidity indicator below
  dayOfMonth: 0.0,        // dominated by the payday indicator below
  dayOfWeek: -0.15,       // weekly slope; weekends slightly worse
  retryCount: -0.35,      // each retry costs us
  hoursSinceFailure: -0.008,  // freshness matters (~10% penalty per 12h)
  amountNaira: -0.0000003, // large charges are less likely to succeed on retry
  isPaydayWindow: 2.0,
  isLiquidityWindow: 1.2,
};

/**
 * Sigmoid activation. Clamped for numerical stability at very large |z|.
 */
export function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Predicts P(success | retry-at-slot) using logistic regression.
 * Deterministic and pure.
 */
export function predictSuccessProbability(
  features: RetryModelFeatures,
  weights: RetryModelWeights = DEFAULT_WEIGHTS,
): number {
  const z =
    weights.intercept +
    weights.hourWAT * features.hourWAT +
    weights.dayOfMonth * features.dayOfMonth +
    weights.dayOfWeek * features.dayOfWeek +
    weights.retryCount * features.retryCount +
    weights.hoursSinceFailure * features.hoursSinceFailure +
    weights.amountNaira * features.amountNaira +
    weights.isPaydayWindow * features.isPaydayWindow +
    weights.isLiquidityWindow * features.isLiquidityWindow;
  return sigmoid(z);
}

export interface RetrySlotScore {
  at: Date;
  probability: number;
  features: RetryModelFeatures;
}

export interface NextRetryModelInput {
  currentTime: Date;
  retryCount: number;
  policy: DunningPolicy;
  amountNaira: number;
  weights?: RetryModelWeights;
  /** Test seam: caps the search to this many hours ahead. Defaults to 72. */
  hoursAhead?: number;
}

/**
 * Score every hour in the lookahead window and return the top-N candidates,
 * ordered best-first. The caller (retry-timing.ts) picks the head, but
 * exposing the full ranked list is useful for explainability / dashboards.
 */
export function rankRetrySlots(input: NextRetryModelInput, topN = 5): RetrySlotScore[] {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const horizon = input.hoursAhead ?? HOURS_LOOKAHEAD;
  const minDelayMs = input.policy.baseDelayMinutes * 60 * 1000;
  const maxDelayMs = input.policy.maxDelayHours * 60 * 60 * 1000;

  const scored: RetrySlotScore[] = [];
  for (let h = 1; h <= horizon; h++) {
    const at = new Date(input.currentTime.getTime() + h * 60 * 60 * 1000);
    const delayMs = at.getTime() - input.currentTime.getTime();
    // Respect the policy floor (must wait at least baseDelayMinutes)
    // and ceiling (never schedule past maxDelayHours).
    if (delayMs < minDelayMs) continue;
    if (delayMs > maxDelayMs) break;

    const features = extractFeatures(at, {
      retryCount: input.retryCount,
      hoursSinceFailure: h,
      amountNaira: input.amountNaira,
    });
    const probability = predictSuccessProbability(features, weights);
    scored.push({ at, probability, features });
  }
  scored.sort((a, b) => b.probability - a.probability);
  return scored.slice(0, topN);
}

/**
 * Returns the highest-probability retry slot per the model. If no slot in
 * the horizon satisfies the policy, returns `currentTime + baseDelayMinutes`
 * as a safety fallback.
 */
export function bestRetrySlot(input: NextRetryModelInput): RetrySlotScore {
  const ranked = rankRetrySlots(input, 1);
  if (ranked.length > 0) return ranked[0]!;
  const fallbackAt = new Date(
    input.currentTime.getTime() + input.policy.baseDelayMinutes * 60 * 1000,
  );
  const features = extractFeatures(fallbackAt, {
    retryCount: input.retryCount,
    hoursSinceFailure: input.policy.baseDelayMinutes / 60,
    amountNaira: input.amountNaira,
  });
  return {
    at: fallbackAt,
    probability: predictSuccessProbability(features, input.weights ?? DEFAULT_WEIGHTS),
    features,
  };
}

interface ExtractionContext {
  retryCount: number;
  hoursSinceFailure: number;
  amountNaira: number;
}

function extractFeatures(at: Date, ctx: ExtractionContext): RetryModelFeatures {
  const wat = new Date(at.getTime() + WAT_OFFSET_MS);
  const hourWAT = wat.getUTCHours();
  const dayOfMonth = wat.getUTCDate();
  const dayOfWeek = wat.getUTCDay();
  const isPaydayWindow = dayOfMonth >= 25 && dayOfMonth <= 30 ? 1 : 0;
  const isLiquidityWindow = hourWAT >= 10 && hourWAT < 14 ? 1 : 0;
  return {
    hourWAT,
    dayOfMonth,
    dayOfWeek,
    retryCount: ctx.retryCount,
    hoursSinceFailure: ctx.hoursSinceFailure,
    amountNaira: ctx.amountNaira,
    isPaydayWindow,
    isLiquidityWindow,
  };
}

/**
 * Training utility — batch gradient descent for the logistic model.
 * Not called at runtime; use from a script when historical
 * charge_attempts have been exported.
 *
 * Each sample is (features, outcome=0|1). Returns learned weights.
 */
export function trainRetryModel(
  samples: Array<{ features: RetryModelFeatures; success: 0 | 1 }>,
  opts: { epochs?: number; learningRate?: number; l2?: number } = {},
): RetryModelWeights {
  const epochs = opts.epochs ?? 200;
  const lr = opts.learningRate ?? 0.01;
  const l2 = opts.l2 ?? 0.001;
  const w: RetryModelWeights = { ...DEFAULT_WEIGHTS };
  const n = samples.length;
  if (n === 0) return w;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0, g8 = 0;
    for (const s of samples) {
      const p = predictSuccessProbability(s.features, w);
      const err = p - s.success;
      g0 += err;
      g1 += err * s.features.hourWAT;
      g2 += err * s.features.dayOfMonth;
      g3 += err * s.features.dayOfWeek;
      g4 += err * s.features.retryCount;
      g5 += err * s.features.hoursSinceFailure;
      g6 += err * s.features.amountNaira;
      g7 += err * s.features.isPaydayWindow;
      g8 += err * s.features.isLiquidityWindow;
    }
    w.intercept -= lr * (g0 / n);
    w.hourWAT -= lr * (g1 / n + l2 * w.hourWAT);
    w.dayOfMonth -= lr * (g2 / n + l2 * w.dayOfMonth);
    w.dayOfWeek -= lr * (g3 / n + l2 * w.dayOfWeek);
    w.retryCount -= lr * (g4 / n + l2 * w.retryCount);
    w.hoursSinceFailure -= lr * (g5 / n + l2 * w.hoursSinceFailure);
    w.amountNaira -= lr * (g6 / n + l2 * w.amountNaira);
    w.isPaydayWindow -= lr * (g7 / n + l2 * w.isPaydayWindow);
    w.isLiquidityWindow -= lr * (g8 / n + l2 * w.isLiquidityWindow);
  }
  return w;
}
