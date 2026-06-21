// services/engine/tests/rails/retry-timing.test.ts
//
// Pure logic tests. Median jitter (rng = 0.5) makes timestamps exact.

import { describe, it, expect } from 'vitest';
import { nextRetryAt } from '../../src/rails/retry-timing.js';
import type { DunningPolicy } from '../../src/state-machines/subscription.js';

const basePolicy: DunningPolicy = {
  maxRetries: 5,
  ussdEnabled: true,
  graceHours: 72,
  baseDelayMinutes: 60,
  maxDelayHours: 72,
};

/** Median jitter: 0.85 + 0.5 * 0.30 = 1.00 → no jitter perturbation. */
const medianRng = () => 0.5;

/** Build a UTC date from WAT wall-clock fields. */
function atWAT(year: number, monthZeroIdx: number, day: number, hourWAT: number, minute = 0) {
  return new Date(Date.UTC(year, monthZeroIdx, day, hourWAT - 1, minute, 0));
}

describe('nextRetryAt', () => {
  describe('exponential backoff', () => {
    it('first retry uses base delay', () => {
      // Pick a current time that lands the result well inside the liquidity window
      // and far from payday, so no snap kicks in.
      const currentTime = atWAT(2026, 6, 10, 9, 30);  // July 10, 09:30 WAT
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // 60 min later: 10:30 WAT → inside liquidity window, no snap
      const expected = atWAT(2026, 6, 10, 10, 30);
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('doubles on each retry count', () => {
      const currentTime = atWAT(2026, 6, 10, 8, 0);   // July 10, 08:00 WAT
      // retryCount=2 → 60 * 2^2 = 240 min = 4h → 12:00 WAT (inside liquidity)
      const result = nextRetryAt({ currentTime, retryCount: 2, policy: basePolicy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 10, 12, 0).toISOString());
    });

    it('caps at maxDelayHours', () => {
      const currentTime = atWAT(2026, 6, 10, 11, 0);
      // retryCount=20 → astronomical; should cap at maxDelayHours=72h
      const policy = { ...basePolicy, maxDelayHours: 24 };
      const result = nextRetryAt({ currentTime, retryCount: 20, policy, rng: medianRng });
      // 24h later = July 11, 11:00 WAT (inside liquidity window)
      expect(result.toISOString()).toBe(atWAT(2026, 6, 11, 11, 0).toISOString());
    });
  });

  describe('liquidity window snap', () => {
    it('pushes a 03:00 WAT candidate to the same day at 11:00 WAT', () => {
      // currentTime 02:00 WAT, retryCount=0 base 60min → candidate 03:00 WAT (outside)
      const currentTime = atWAT(2026, 6, 10, 2, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 10, 11, 0).toISOString());
    });

    it('pushes a late-night candidate to the next day at 11:00 WAT', () => {
      // currentTime 22:00 WAT, retryCount=0 base 60min → candidate 23:00 WAT (outside)
      const currentTime = atWAT(2026, 6, 10, 22, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 11, 11, 0).toISOString());
    });

    it('leaves a candidate already in the liquidity window alone', () => {
      // currentTime 10:30 WAT, retryCount=0 base 60min → candidate 11:30 WAT (inside)
      const currentTime = atWAT(2026, 6, 10, 10, 30);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 10, 11, 30).toISOString());
    });

    it('treats 14:00 WAT as outside the window (upper bound exclusive)', () => {
      // currentTime 13:00 WAT, retryCount=0 → candidate 14:00 WAT (outside)
      const currentTime = atWAT(2026, 6, 10, 13, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // pushed to next day at 11:00 WAT
      expect(result.toISOString()).toBe(atWAT(2026, 6, 11, 11, 0).toISOString());
    });
  });

  describe('payday snap', () => {
    it('snaps to payday when candidate lands ≤7 days before the 25th', () => {
      // currentTime July 20, 11:00 WAT (5 days before payday opens)
      const currentTime = atWAT(2026, 6, 20, 11, 0);
      // retryCount=0 → candidate July 20 12:00 WAT (within 7d of payday)
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // Should snap to July 25 at 11:00 WAT
      expect(result.toISOString()).toBe(atWAT(2026, 6, 25, 11, 0).toISOString());
    });

    it('keeps payday snap if the candidate is already within the payday window', () => {
      // currentTime July 26, 09:00 WAT → in payday window
      const currentTime = atWAT(2026, 6, 26, 9, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // Snaps to that day's 11:00 WAT
      expect(result.toISOString()).toBe(atWAT(2026, 6, 26, 11, 0).toISOString());
    });

    it('does NOT snap when the candidate is far from any payday', () => {
      // currentTime July 5, 11:00 WAT → ~20 days from payday
      const currentTime = atWAT(2026, 6, 5, 11, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // normal +60min, inside liquidity → July 5, 12:00 WAT
      expect(result.toISOString()).toBe(atWAT(2026, 6, 5, 12, 0).toISOString());
    });

    it('does NOT snap on the 1st of the month (far before next payday)', () => {
      const currentTime = atWAT(2026, 6, 1, 10, 30);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      // +60min → 11:30 WAT, inside liquidity → no snap
      expect(result.toISOString()).toBe(atWAT(2026, 6, 1, 11, 30).toISOString());
    });

    it('payday snap takes priority over liquidity snap', () => {
      // currentTime July 23, 23:00 WAT → +1h = July 24, 00:00 WAT
      // That candidate is 1 day before payday AND outside liquidity.
      // Payday snap should win.
      const currentTime = atWAT(2026, 6, 23, 23, 0);
      const result = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 25, 11, 0).toISOString());
    });
  });

  describe('jitter', () => {
    it('is deterministic given a fixed rng', () => {
      const currentTime = atWAT(2026, 6, 10, 9, 0);
      const fixed = () => 0.5;
      const a = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: fixed });
      const b = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: fixed });
      expect(a.toISOString()).toBe(b.toISOString());
    });

    it('varies output when rng changes', () => {
      const currentTime = atWAT(2026, 6, 10, 9, 0);
      const low = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: () => 0 });
      const high = nextRetryAt({ currentTime, retryCount: 0, policy: basePolicy, rng: () => 1 });
      // With rng=0, jitter factor = 0.85; with rng=1, jitter factor = 1.15
      // Both candidates land inside liquidity, no snap, so the difference is preserved.
      expect(low.toISOString()).not.toBe(high.toISOString());
    });
  });

  describe('per-merchant config', () => {
    it('respects custom baseDelayMinutes', () => {
      // baseDelay 30 min, retryCount 0 → candidate +30 min
      const currentTime = atWAT(2026, 6, 10, 10, 0);
      const policy = { ...basePolicy, baseDelayMinutes: 30 };
      const result = nextRetryAt({ currentTime, retryCount: 0, policy, rng: medianRng });
      expect(result.toISOString()).toBe(atWAT(2026, 6, 10, 10, 30).toISOString());
    });

    it('respects custom maxDelayHours cap', () => {
      // retryCount=10 → 60 * 1024 min = ~17h naturally, but cap is 6h
      const currentTime = atWAT(2026, 6, 10, 11, 0);
      const policy = { ...basePolicy, maxDelayHours: 6 };
      const result = nextRetryAt({ currentTime, retryCount: 10, policy, rng: medianRng });
      // +6h = 17:00 WAT, outside liquidity → snap to next day 11:00
      expect(result.toISOString()).toBe(atWAT(2026, 6, 11, 11, 0).toISOString());
    });
  });
});
