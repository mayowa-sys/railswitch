// services/engine/src/ai/churn-scoring.ts
//
// Churn risk scoring. Given a snapshot of a subscription's payment
// history and state, returns a 0-1 probability that the customer will
// be lost within the next billing cycle.
//
// Model shape is identical to retry-timing-model.ts: hand-crafted
// features + logistic regression with hand-tuned weights + optional
// batch trainer. Everything is pure and offline.
//
// Non-goals:
//   - Reason attribution / SHAP values. We surface the top-3 contributing
//     features from a scored subscription (see `explain`), which is enough
//     for a dashboard tooltip.
//   - Multi-cycle time-series modeling. This is a per-cycle snapshot.

export type ChurnBand = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnFeatures {
  /** Total failed charge attempts on this subscription. */
  failedAttempts: number;
  /** Successful charges since signup. */
  successfulCharges: number;
  /** Days since the subscription was created. */
  daysSinceSignup: number;
  /** Days since the most recent successful charge (or since signup if none). */
  daysSinceLastSuccess: number;
  /** Retry count within the CURRENT cycle. */
  currentRetryCount: number;
  /** Furthest cascade stage the current cycle reached. Higher = deeper trouble. */
  cascadeStageDepth: 0 | 1 | 2 | 3 | 4;
  /** Plan monthly price in naira. */
  planPriceNaira: number;
  /** 1 if the customer has ever paused, else 0. */
  hasPaused: 0 | 1;
  /** 1 if state is currently past_due, else 0. */
  isPastDue: 0 | 1;
}

export interface ChurnWeights {
  intercept: number;
  failedAttempts: number;
  successfulCharges: number;
  daysSinceSignup: number;
  daysSinceLastSuccess: number;
  currentRetryCount: number;
  cascadeStageDepth: number;
  planPriceNaira: number;
  hasPaused: number;
  isPastDue: number;
}

/**
 * Cascade stages mapped to depth for the feature vector. Callers convert
 * the subscription's current state to depth via `cascadeDepthForState`.
 */
export function cascadeDepthForState(state: string): 0 | 1 | 2 | 3 | 4 {
  switch (state) {
    case 'retrying': return 1;
    case 'va_fallback': return 2;
    case 'ussd_fallback':
    case 'whatsapp_fallback': return 3;
    case 'past_due': return 4;
    default: return 0;
  }
}

/**
 * Default weights — tuned so that a healthy subscription (no failures,
 * recent success) sits below 0.15, and a subscription in past_due with
 * 3+ retries sits above 0.85.
 */
export const DEFAULT_CHURN_WEIGHTS: ChurnWeights = {
  intercept: -3.0,
  failedAttempts: 0.45,
  successfulCharges: -0.20,
  daysSinceSignup: -0.005,   // loyalty compounds slowly
  daysSinceLastSuccess: 0.04,
  currentRetryCount: 0.65,
  cascadeStageDepth: 0.90,
  planPriceNaira: 0.00001,   // higher-priced plans are marginally stickier to lose
  hasPaused: 0.30,
  isPastDue: 1.5,
};

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

export interface ChurnScoreResult {
  risk: number;         // 0..1
  band: ChurnBand;
  /** Top-3 features by absolute contribution to the logit. */
  topDrivers: Array<{ feature: keyof ChurnFeatures; contribution: number }>;
}

export function scoreChurn(
  features: ChurnFeatures,
  weights: ChurnWeights = DEFAULT_CHURN_WEIGHTS,
): ChurnScoreResult {
  const contribs: Record<keyof ChurnFeatures, number> = {
    failedAttempts: weights.failedAttempts * features.failedAttempts,
    successfulCharges: weights.successfulCharges * features.successfulCharges,
    daysSinceSignup: weights.daysSinceSignup * features.daysSinceSignup,
    daysSinceLastSuccess: weights.daysSinceLastSuccess * features.daysSinceLastSuccess,
    currentRetryCount: weights.currentRetryCount * features.currentRetryCount,
    cascadeStageDepth: weights.cascadeStageDepth * features.cascadeStageDepth,
    planPriceNaira: weights.planPriceNaira * features.planPriceNaira,
    hasPaused: weights.hasPaused * features.hasPaused,
    isPastDue: weights.isPastDue * features.isPastDue,
  };
  const z = weights.intercept + Object.values(contribs).reduce((a, b) => a + b, 0);
  const risk = sigmoid(z);
  const topDrivers = (Object.keys(contribs) as Array<keyof ChurnFeatures>)
    .map(k => ({ feature: k, contribution: contribs[k] }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);
  return { risk, band: band(risk), topDrivers };
}

function band(risk: number): ChurnBand {
  if (risk >= 0.75) return 'critical';
  if (risk >= 0.5) return 'high';
  if (risk >= 0.25) return 'medium';
  return 'low';
}

/**
 * Training utility — same shape as retry-timing-model.trainRetryModel.
 * Not called at runtime.
 */
export function trainChurnModel(
  samples: Array<{ features: ChurnFeatures; churned: 0 | 1 }>,
  opts: { epochs?: number; learningRate?: number; l2?: number } = {},
): ChurnWeights {
  const epochs = opts.epochs ?? 300;
  const lr = opts.learningRate ?? 0.005;
  const l2 = opts.l2 ?? 0.001;
  const w: ChurnWeights = { ...DEFAULT_CHURN_WEIGHTS };
  const n = samples.length;
  if (n === 0) return w;
  const keys: Array<keyof ChurnFeatures> = [
    'failedAttempts', 'successfulCharges', 'daysSinceSignup', 'daysSinceLastSuccess',
    'currentRetryCount', 'cascadeStageDepth', 'planPriceNaira', 'hasPaused', 'isPastDue',
  ];
  for (let epoch = 0; epoch < epochs; epoch++) {
    let gInt = 0;
    const grads: Record<keyof ChurnFeatures, number> = Object.fromEntries(
      keys.map(k => [k, 0]),
    ) as Record<keyof ChurnFeatures, number>;
    for (const s of samples) {
      const p = scoreChurn(s.features, w).risk;
      const err = p - s.churned;
      gInt += err;
      for (const k of keys) grads[k] += err * s.features[k];
    }
    w.intercept -= lr * (gInt / n);
    for (const k of keys) {
      (w as unknown as Record<string, number>)[k] -=
        lr * (grads[k] / n + l2 * (w as unknown as Record<string, number>)[k]);
    }
  }
  return w;
}
