import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/client.js', () => ({
  db: {
    execute: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock('../../src/proration/proration-helper.js', () => ({
  getSubscription: vi.fn(),
}));

import { db } from '../../src/db/client.js';
import * as ProrationHelper from '../../src/proration/proration-helper.js';
import { pauseSubscription } from '../../src/proration/pause-subcription.js';
import { SubscriptionsTable } from '../../src/schema/subscriptions.schema.js';

const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));

describe('pauseSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns immediately when the subscription is already paused', async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({ state: 'paused' } as typeof SubscriptionsTable.$inferSelect);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = { processEvent: vi.fn() } as any;

    await pauseSubscription('sub_1', 'mer_1', wrapper);

    expect(db.execute).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(wrapper.processEvent).not.toHaveBeenCalled();
  });

  it("throws when the subscription isn't active", async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({ state: 'cancelled' } as typeof SubscriptionsTable.$inferSelect);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = { processEvent: vi.fn() } as any;

    await expect(pauseSubscription('sub_1', 'mer_1', wrapper)).rejects.toThrow(
      "You can't pause from this state",
    );

    expect(db.update).not.toHaveBeenCalled();
    expect(wrapper.processEvent).not.toHaveBeenCalled();
  });

  it('requests pause for an active subscription', async () => {
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.update).mockImplementation(mockUpdate as any);
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({ state: 'active' } as typeof SubscriptionsTable.$inferSelect);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapper = { processEvent: vi.fn(() => Promise.resolve()) } as any;

    await pauseSubscription('sub_1', 'mer_1', wrapper);

    expect(db.execute).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(wrapper.processEvent).toHaveBeenCalledWith({
      subscriptionId: 'sub_1',
      event: { type: 'PAUSE_REQUESTED', actor: 'customer' },
      idempotencyKey: 'idem',
    });
  });
});
