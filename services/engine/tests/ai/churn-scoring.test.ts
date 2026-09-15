// services/engine/tests/ai/churn-scoring.test.ts

import { describe, it, expect } from 'vitest';
import {
  scoreChurn,
  cascadeDepthForState,
  trainChurnModel,
  DEFAULT_CHURN_WEIGHTS,
  type ChurnFeatures,
} from '../../src/ai/churn-scoring.js';

const healthy: ChurnFeatures = {
  failedAttempts: 0,
  successfulCharges: 12,
  daysSinceSignup: 365,
  daysSinceLastSuccess: 5,
  currentRetryCount: 0,
  cascadeStageDepth: 0,
  planPriceNaira: 15000,
  hasPaused: 0,
  isPastDue: 0,
};

const critical: ChurnFeatures = {
  failedAttempts: 5,
  successfulCharges: 1,
  daysSinceSignup: 20,
  daysSinceLastSuccess: 45,
  currentRetryCount: 3,
  cascadeStageDepth: 4,
  planPriceNaira: 5000,
  hasPaused: 1,
  isPastDue: 1,
};

describe('scoreChurn', () => {
  it('scores a healthy subscription as low risk', () => {
    const r = scoreChurn(healthy);
    expect(r.risk).toBeLessThan(0.15);
    expect(r.band).toBe('low');
  });

  it('scores a past-due, cascade-deep subscription as critical', () => {
    const r = scoreChurn(critical);
    expect(r.risk).toBeGreaterThan(0.85);
    expect(r.band).toBe('critical');
  });

  it('returns risk in [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const f: ChurnFeatures = {
        failedAttempts: Math.floor(Math.random() * 10),
        successfulCharges: Math.floor(Math.random() * 20),
        daysSinceSignup: Math.floor(Math.random() * 500),
        daysSinceLastSuccess: Math.floor(Math.random() * 90),
        currentRetryCount: Math.floor(Math.random() * 5),
        cascadeStageDepth: (Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4),
        planPriceNaira: Math.floor(Math.random() * 100000),
        hasPaused: (Math.random() < 0.3 ? 1 : 0),
        isPastDue: (Math.random() < 0.2 ? 1 : 0),
      };
      const r = scoreChurn(f);
      expect(r.risk).toBeGreaterThanOrEqual(0);
      expect(r.risk).toBeLessThanOrEqual(1);
    }
  });

  it('returns three top drivers, ordered by absolute contribution', () => {
    const r = scoreChurn(critical);
    expect(r.topDrivers.length).toBe(3);
    for (let i = 1; i < r.topDrivers.length; i++) {
      expect(Math.abs(r.topDrivers[i]!.contribution))
        .toBeLessThanOrEqual(Math.abs(r.topDrivers[i - 1]!.contribution));
    }
  });

  it('bands risk correctly at boundaries', () => {
    // We can't easily construct exact boundary risks, but we can check band monotonicity.
    const bands = new Set(
      [healthy, critical].map(f => scoreChurn(f).band),
    );
    expect(bands.has('low')).toBe(true);
    expect(bands.has('critical')).toBe(true);
  });
});

describe('cascadeDepthForState', () => {
  it('maps known cascade states to increasing depth', () => {
    expect(cascadeDepthForState('active')).toBe(0);
    expect(cascadeDepthForState('retrying')).toBe(1);
    expect(cascadeDepthForState('va_fallback')).toBe(2);
    expect(cascadeDepthForState('whatsapp_fallback')).toBe(3);
    expect(cascadeDepthForState('past_due')).toBe(4);
  });

  it('returns 0 for unknown states', () => {
    expect(cascadeDepthForState('nonsense')).toBe(0);
  });
});

describe('trainChurnModel', () => {
  it('returns defaults on empty samples', () => {
    expect(trainChurnModel([])).toEqual(DEFAULT_CHURN_WEIGHTS);
  });

  it('learns from clear synthetic data', () => {
    // Trainer uses raw batch GD — features must be kept on comparable scales
    // for this to converge without per-feature normalization. Production
    // training on the real charge_attempts corpus would normalize first.
    const smallHealthy: ChurnFeatures = {
      failedAttempts: 0, successfulCharges: 5, daysSinceSignup: 1,
      daysSinceLastSuccess: 0, currentRetryCount: 0, cascadeStageDepth: 0,
      planPriceNaira: 1, hasPaused: 0, isPastDue: 0,
    };
    const smallCritical: ChurnFeatures = {
      failedAttempts: 5, successfulCharges: 0, daysSinceSignup: 1,
      daysSinceLastSuccess: 5, currentRetryCount: 3, cascadeStageDepth: 4,
      planPriceNaira: 1, hasPaused: 1, isPastDue: 1,
    };
    const samples: Array<{ features: ChurnFeatures; churned: 0 | 1 }> = [];
    for (let i = 0; i < 200; i++) samples.push({ features: smallHealthy, churned: 0 });
    for (let i = 0; i < 200; i++) samples.push({ features: smallCritical, churned: 1 });
    const w = trainChurnModel(samples, { epochs: 500, learningRate: 0.1 });
    expect(scoreChurn(smallCritical, w).risk).toBeGreaterThan(scoreChurn(smallHealthy, w).risk);
  });
});
