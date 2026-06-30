import { describe, expect, it } from 'vitest';
import { estimateCreditApplication } from '../../src/proration/plan-change.js';

describe('estimateCreditApplication', () => {
  it('applies credits until the charge is fully covered', () => {
    const result = estimateCreditApplication(150, [
      { id: 'c1', amount: '100', amount_consumed: '0' },
      { id: 'c2', amount: '80', amount_consumed: '20' },
    ]);

    expect(result).toEqual({ netCharge: 0, creditApplied: 150 });
  });

  it('leaves a remaining charge when credits are insufficient', () => {
    const result = estimateCreditApplication(250, [
      { id: 'c1', amount: '100', amount_consumed: '0' },
      { id: 'c2', amount: '80', amount_consumed: '0' },
    ]);

    expect(result).toEqual({ netCharge: 70, creditApplied: 180 });
  });

  it('ignores credits that are already fully consumed', () => {
    const result = estimateCreditApplication(100, [
      { id: 'c1', amount: '100', amount_consumed: '100' },
      { id: 'c2', amount: '50', amount_consumed: '20' },
    ]);

    expect(result).toEqual({ netCharge: 70, creditApplied: 30 });
  });

  it('returns the original charge when no credits are available', () => {
    const result = estimateCreditApplication(120, []);

    expect(result).toEqual({ netCharge: 120, creditApplied: 0 });
  });
});
