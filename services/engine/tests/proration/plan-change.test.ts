import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db/client.js';
import * as ProrationHelper from '../../src/proration/proration-helper.js';
import { handlePlanChange } from '../../src/proration/plan-change.js';

const mockExecute = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockInsertReturning = vi.fn(() => Promise.resolve([{ id: 'invoice_1' }]));
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockGetSubscription = vi.fn();
const mockGetRemainingCredits = vi.fn();
const mockApplyCreditsToCharge = vi.fn();
const mockHandlePayments = vi.fn();

const dummyBillingHandler = {} as any;

describe('handlePlanChange', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, 'execute').mockImplementation(mockExecute);
    vi.spyOn(db, 'select').mockImplementation(mockSelect);
    vi.spyOn(db, 'update').mockImplementation(mockUpdate);
    vi.spyOn(db, 'insert').mockImplementation(mockInsert);
    vi.spyOn(ProrationHelper, 'getSubscription').mockImplementation(mockGetSubscription);
    vi.spyOn(ProrationHelper, 'getRemainingCredits').mockImplementation(mockGetRemainingCredits);
    vi.spyOn(ProrationHelper, 'applyCreditsToCharge').mockImplementation(mockApplyCreditsToCharge);
    vi.spyOn(ProrationHelper, 'handlePayments').mockImplementation(mockHandlePayments);

    mockExecute.mockReset();
    mockSelect.mockReset();
    mockSelectWhere.mockReset();
    mockUpdate.mockReset();
    mockUpdateSet.mockReset();
    mockInsert.mockReset();
    mockInsertValues.mockReset();
    mockInsertReturning.mockReset();
    mockGetSubscription.mockReset();
    mockGetRemainingCredits.mockReset();
    mockApplyCreditsToCharge.mockReset();
    mockHandlePayments.mockReset();
  });

  it('throws when current and new plan IDs are identical', async () => {
    await expect(
      handlePlanChange('sub_1', 'plan_1', 'plan_1', 'mer_1', dummyBillingHandler),
    ).rejects.toThrow('Current Plan and New Plan cannot be the same');

    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('throws when the subscription is in a non-changeable state', async () => {
    mockGetSubscription.mockResolvedValue({ state: 'cancelled' });

    await expect(
      handlePlanChange('sub_1', 'plan_1', 'plan_2', 'mer_1', dummyBillingHandler),
    ).rejects.toThrow("You can't change plan during this state");
  });

  it('stores downgrade credits and updates the subscription when total share is negative', async () => {
    mockGetSubscription.mockResolvedValue({ state: 'active' });
    mockSelectWhere
      .mockResolvedValueOnce([{ id: 'plan_1' }])
      .mockResolvedValueOnce([{ id: 'plan_2' }]);
    mockGetRemainingCredits.mockResolvedValueOnce(100);
    mockGetRemainingCredits.mockResolvedValueOnce(50);

    await handlePlanChange('sub_1', 'plan_1', 'plan_2', 'mer_1', dummyBillingHandler);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '50',
        merchant_id: 'mer_1',
        subscription_id: 'sub_1',
        source: 'downgrade',
      }),
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith({ plan_id: 'plan_2' });
    expect(mockHandlePayments).not.toHaveBeenCalled();
  });

  it('creates an invoice and invokes payment handling when the plan change requires a charge', async () => {
    mockGetSubscription.mockResolvedValue({ state: 'active' });
    mockSelectWhere
      .mockResolvedValueOnce([{ id: 'plan_1' }])
      .mockResolvedValueOnce([{ id: 'plan_2' }])
      .mockResolvedValueOnce([]);
    mockGetRemainingCredits.mockResolvedValueOnce(0);
    mockGetRemainingCredits.mockResolvedValueOnce(100);

    await handlePlanChange('sub_1', 'plan_1', 'plan_2', 'mer_1', dummyBillingHandler);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '100',
        merchant_id: 'mer_1',
        subscription_id: 'sub_1',
        status: 'open',
        currency: 'NGN',
        description: 'Invoice Charge for plan change',
      }),
    );
    expect(mockHandlePayments).toHaveBeenCalledWith('sub_1', 'invoice_1', 100, dummyBillingHandler);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        current_invoice_id: 'invoice_1',
        plan_id: 'plan_2',
        retry_count: 0,
      }),
    );
  });
});
