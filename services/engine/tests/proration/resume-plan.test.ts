import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db/client.js';
import * as ProrationHelper from '../../src/proration/proration-helper.js';
import { resumeSubscription } from '../../src/proration/resume-plan.js';

const mockExecute = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn(() => ({ from: () => ({ where: mockSelectWhere }) }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockGetSubscription = vi.fn();

describe('resumeSubscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'execute').mockImplementation(mockExecute);
    vi.spyOn(db, 'select').mockImplementation(mockSelect);
    vi.spyOn(db, 'update').mockImplementation(mockUpdate);
    vi.spyOn(ProrationHelper, 'getSubscription').mockImplementation(mockGetSubscription);

    mockExecute.mockReset();
    mockSelect.mockReset();
    mockSelectWhere.mockReset();
    mockUpdate.mockReset();
    mockUpdateSet.mockReset();
    mockGetSubscription.mockReset();
  });

  it('returns early when the subscription was not paused', async () => {
    mockGetSubscription.mockResolvedValue({ paused_at: null, next_billing_at: new Date(), plan_id: 'plan_1' });
    const wrapper = { processEvent: vi.fn() };

    await resumeSubscription('sub_1', 'mer_1', wrapper);

    expect(mockExecute).toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(wrapper.processEvent).not.toHaveBeenCalled();
  });

  it('throws when the paused subscription has no next_billing_at value', async () => {
    mockGetSubscription.mockResolvedValue({ paused_at: new Date('2026-06-01T00:00:00Z'), next_billing_at: null, plan_id: 'plan_1' });
    const wrapper = { processEvent: vi.fn() };

    await expect(
      resumeSubscription('sub_1', 'mer_1', wrapper),
    ).rejects.toThrow('Subscription does not have next_billing_at property');

    expect(mockSelect).not.toHaveBeenCalled();
    expect(wrapper.processEvent).not.toHaveBeenCalled();
  });

  it('throws when the plan does not exist', async () => {
    mockGetSubscription.mockResolvedValue({ paused_at: new Date('2026-06-01T00:00:00Z'), next_billing_at: new Date('2026-06-05T00:00:00Z'), plan_id: 'plan_1' });
    mockSelectWhere.mockResolvedValueOnce([]);
    const wrapper = { processEvent: vi.fn() };

    await expect(
      resumeSubscription('sub_1', 'mer_1', wrapper),
    ).rejects.toThrow('This plan_1 plan does not exist');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(wrapper.processEvent).not.toHaveBeenCalled();
  });

  it('resumes a paused subscription and updates billing dates', async () => {
    const pausedAt = new Date('2026-06-01T00:00:00Z');
    const nextBillingAt = new Date('2026-06-05T00:00:00Z');
    mockGetSubscription.mockResolvedValue({ paused_at: pausedAt, next_billing_at: nextBillingAt, plan_id: 'plan_1' });
    mockSelectWhere.mockResolvedValueOnce([{ id: 'plan_1' }]);
    const processEvent = vi.fn(() => Promise.resolve());
    const wrapper = { processEvent };

    await resumeSubscription('sub_1', 'mer_1', wrapper);

    expect(mockExecute).toHaveBeenCalled();
    expect(processEvent).toHaveBeenCalledWith({
      subscriptionId: 'sub_1',
      event: { type: 'RESUME_REQUESTED', actor: 'customer' },
      idempotencyKey: 'idemKey',
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        next_billing_at: expect.any(Date),
        current_period_end: expect.any(Date),
      }),
    );

    const updatedNextBillingAt = mockUpdateSet.mock.calls[0][0].next_billing_at as Date;
    expect(updatedNextBillingAt.getTime()).toBeGreaterThan(nextBillingAt.getTime());
  });
});
