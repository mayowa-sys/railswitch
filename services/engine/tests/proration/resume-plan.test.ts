import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/client.js', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(() => ({ from: () => ({ where: vi.fn() }) })),
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
import { applyResumeAdjustments } from '../../src/proration/resume-plan.js';
import { SubscriptionsTable } from '../../src/schema/subscriptions.schema.js';

const mockWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.select).mockImplementation(() => ({ from: () => ({ where: mockWhere }) }) as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.update).mockImplementation(() => ({ set: mockUpdateSet } as any));
});

describe('applyResumeAdjustments', () => {
  it('returns early when the subscription has no paused_at', async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({
      paused_at: null,
      next_billing_at: new Date(),
      plan_id: 'plan_1',
      state: 'active',
    } as typeof SubscriptionsTable.$inferSelect);

    await applyResumeAdjustments('sub_1', 'mer_1');

    expect(db.execute).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('throws when the paused subscription has no next_billing_at value', async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({
      paused_at: new Date('2026-06-01T00:00:00Z'),
      next_billing_at: null,
      plan_id: 'plan_1',
      state: 'active',
    } as typeof SubscriptionsTable.$inferSelect);

    await expect(applyResumeAdjustments('sub_1', 'mer_1')).rejects.toThrow(
      'Subscription does not have next_billing_at property',
    );
  });

  it('throws when the plan does not exist', async () => {
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({
      paused_at: new Date('2026-06-01T00:00:00Z'),
      next_billing_at: new Date('2026-06-05T00:00:00Z'),
      plan_id: 'plan_1',
      state: 'active',
    } as typeof SubscriptionsTable.$inferSelect);
    mockWhere.mockResolvedValueOnce([]);

    await expect(applyResumeAdjustments('sub_1', 'mer_1')).rejects.toThrow(
      'Plan plan_1 does not exist',
    );

    expect(db.update).not.toHaveBeenCalled();
  });

  it('resumes a paused subscription and extends billing dates by pause duration', async () => {
    const pausedAt = new Date('2026-06-01T00:00:00Z');
    const nextBillingAt = new Date('2026-06-05T00:00:00Z');
    vi.mocked(ProrationHelper.getSubscription).mockResolvedValue({
      paused_at: pausedAt,
      next_billing_at: nextBillingAt,
      plan_id: 'plan_1',
      state: 'active',
    } as typeof SubscriptionsTable.$inferSelect);
    mockWhere.mockResolvedValueOnce([{ id: 'plan_1', name: 'Test Plan', interval: 'monthly', interval_count: 1, amount: '5000' }]);

    await applyResumeAdjustments('sub_1', 'mer_1');

    expect(db.execute).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        next_billing_at: expect.any(Date),
        current_period_end: expect.any(Date),
        paused_at: null,
      }),
    );
  });
});
