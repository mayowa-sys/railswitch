import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/client.js', () => ({
  db: {
    execute: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => []),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock('../../src/proration/proration-helper.js', () => ({
  getSubscription: vi.fn(),
  getRemainingCredits: vi.fn(),
}));

import { db } from '../../src/db/client.js';
import * as ProrationHelper from '../../src/proration/proration-helper.js';
import { applyPauseAdjustments } from '../../src/proration/pause-subcription.js';
import { SubscriptionsTable } from '../../src/schema/subscriptions.schema.js';

const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));

describe('applyPauseAdjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the subscription is not paused', async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({ state: 'active' } as typeof SubscriptionsTable.$inferSelect);

    await expect(applyPauseAdjustments('sub_1', 'mer_1')).rejects.toThrow(
      'Subscription must be in paused state to apply adjustments',
    );
  });

  it('stores paused_at for a paused subscription', async () => {
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.update).mockImplementation(mockUpdate as any);
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({
      state: 'paused',
      plan_id: 'plan_1',
    } as typeof SubscriptionsTable.$inferSelect);

    await applyPauseAdjustments('sub_1', 'mer_1');

    expect(db.execute).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
