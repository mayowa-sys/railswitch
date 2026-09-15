// services/engine/tests/ai/retry-model.test.ts
//
// Pure-function tests for the ML retry timing scorer.

import { describe, it, expect } from 'vitest';
import {
  sigmoid,
  predictSuccessProbability,
  rankRetrySlots,
  bestRetrySlot,
  trainRetryModel,
  DEFAULT_WEIGHTS,
  type RetryModelFeatures,
} from '../../src/ai/retry-timing-model.js';
import type { DunningPolicy } from '../../src/state-machines/subscription.js';

const basePolicy: DunningPolicy = {
  maxRetries: 5,
  ussdEnabled: true,
  graceHours: 72,
  baseDelayMinutes: 60,
  maxDelayHours: 72,
};

function atWAT(year: number, monthZeroIdx: number, day: number, hourWAT: number) {
  return new Date(Date.UTC(year, monthZeroIdx, day, hourWAT - 1, 0, 0));
}

describe('sigmoid', () => {
  it('is 0.5 at zero', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 6);
  });
  it('is bounded in [0, 1]', () => {
    expect(sigmoid(-100)).toBeGreaterThanOrEqual(0);
    expect(sigmoid(100)).toBeLessThanOrEqual(1);
  });
  it('is monotonic', () => {
    expect(sigmoid(-1)).toBeLessThan(sigmoid(0));
    expect(sigmoid(0)).toBeLessThan(sigmoid(1));
  });
});

describe('predictSuccessProbability', () => {
  const baseFeatures: RetryModelFeatures = {
    hourWAT: 11,
    dayOfMonth: 15,
    dayOfWeek: 3,
    retryCount: 0,
    hoursSinceFailure: 1,
    amountNaira: 10000,
    isPaydayWindow: 0,
    isLiquidityWindow: 1,
  };

  it('returns a probability in [0, 1]', () => {
    const p = predictSuccessProbability(baseFeatures);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('rewards payday window heavily', () => {
    const pNoPayday = predictSuccessProbability({ ...baseFeatures, isPaydayWindow: 0 });
    const pPayday = predictSuccessProbability({ ...baseFeatures, isPaydayWindow: 1 });
    expect(pPayday).toBeGreaterThan(pNoPayday + 0.1);
  });

  it('penalizes higher retry counts', () => {
    const pFirst = predictSuccessProbability({ ...baseFeatures, retryCount: 0 });
    const pFifth = predictSuccessProbability({ ...baseFeatures, retryCount: 5 });
    expect(pFirst).toBeGreaterThan(pFifth);
  });

  it('is deterministic', () => {
    const a = predictSuccessProbability(baseFeatures);
    const b = predictSuccessProbability(baseFeatures);
    expect(a).toBe(b);
  });
});

describe('rankRetrySlots', () => {
  it('produces monotonically decreasing probabilities', () => {
    const currentTime = atWAT(2026, 6, 20, 8, 0);
    const ranked = rankRetrySlots({ currentTime, retryCount: 0, policy: basePolicy, amountNaira: 5000 }, 10);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i]!.probability).toBeLessThanOrEqual(ranked[i - 1]!.probability);
    }
  });

  it('respects the policy floor', () => {
    const currentTime = atWAT(2026, 6, 20, 8, 0);
    const ranked = rankRetrySlots(
      { currentTime, retryCount: 0, policy: { ...basePolicy, baseDelayMinutes: 240 }, amountNaira: 5000 },
      3,
    );
    // Every slot must be at least 240 min after currentTime → 12:00 WAT
    for (const r of ranked) {
      const delay = r.at.getTime() - currentTime.getTime();
      expect(delay).toBeGreaterThanOrEqual(240 * 60 * 1000);
    }
  });

  it('respects the policy ceiling', () => {
    const currentTime = atWAT(2026, 6, 20, 8, 0);
    const ranked = rankRetrySlots(
      { currentTime, retryCount: 0, policy: { ...basePolicy, maxDelayHours: 6 }, amountNaira: 5000 },
      100,
    );
    for (const r of ranked) {
      const delay = r.at.getTime() - currentTime.getTime();
      expect(delay).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
    }
  });

  it('prefers slots inside the payday window when close', () => {
    // 1 day before payday, so the horizon comfortably contains payday hours.
    const currentTime = atWAT(2026, 6, 24, 8, 0);
    const ranked = rankRetrySlots({ currentTime, retryCount: 0, policy: basePolicy, amountNaira: 5000 }, 1);
    expect(ranked[0]?.features.isPaydayWindow).toBe(1);
  });
});

describe('bestRetrySlot', () => {
  it('returns a slot that is within the horizon and after currentTime', () => {
    const currentTime = atWAT(2026, 6, 20, 8, 0);
    const best = bestRetrySlot({ currentTime, retryCount: 0, policy: basePolicy, amountNaira: 5000 });
    expect(best.at.getTime()).toBeGreaterThan(currentTime.getTime());
    expect(best.at.getTime() - currentTime.getTime()).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
  });

  it('never returns a slot outside the liquidity window when a liquidity slot is available', () => {
    // Far from payday, mid-month — liquidity should dominate.
    const currentTime = atWAT(2026, 6, 10, 6, 0);
    const best = bestRetrySlot({ currentTime, retryCount: 0, policy: basePolicy, amountNaira: 5000 });
    expect(best.features.isLiquidityWindow).toBe(1);
  });
});

describe('trainRetryModel', () => {
  it('returns default weights on empty sample set', () => {
    const w = trainRetryModel([]);
    expect(w).toEqual(DEFAULT_WEIGHTS);
  });

  it('moves toward the data', () => {
    // Synthetic: liquidity-window retries succeed, non-liquidity retries fail.
    // Feature magnitudes are kept modest so raw batch GD converges without
    // per-feature scaling. Production training would normalize features first.
    const good: RetryModelFeatures = {
      hourWAT: 11, dayOfMonth: 15, dayOfWeek: 3, retryCount: 0,
      hoursSinceFailure: 1, amountNaira: 1, isPaydayWindow: 0, isLiquidityWindow: 1,
    };
    const bad: RetryModelFeatures = {
      hourWAT: 3, dayOfMonth: 15, dayOfWeek: 3, retryCount: 0,
      hoursSinceFailure: 1, amountNaira: 1, isPaydayWindow: 0, isLiquidityWindow: 0,
    };
    const samples: Array<{ features: RetryModelFeatures; success: 0 | 1 }> = [];
    for (let i = 0; i < 100; i++) samples.push({ features: good, success: 1 });
    for (let i = 0; i < 100; i++) samples.push({ features: bad, success: 0 });
    const w = trainRetryModel(samples, { epochs: 500, learningRate: 0.1 });
    const pGood = predictSuccessProbability(good, w);
    const pBad = predictSuccessProbability(bad, w);
    expect(pGood).toBeGreaterThan(pBad);
  });
});
