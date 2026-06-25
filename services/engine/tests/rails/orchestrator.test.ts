// services/engine/tests/rails/orchestrator.test.ts
//
// These tests verify the orchestrator wires correctly to the NombaClient and
// surfaces results faithfully. Full cascade behavior is the wrapper's job
// (separate test file, separate PR).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RailOrchestrator } from '../../src/rails/orchestrator.js';
import { MockNombaClient } from '../../src/rails/mock-nomba-client.js';
import { UnsupportedRailError } from '../../src/rails/nomba-client.js';
import type { SubscriptionContext } from '../../src/state-machines/subscription.js';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeContext(): SubscriptionContext {
  return {
    subscriptionId: 'sub_test',
    merchantId: 'mer_test_abc12345',
    customerId: 'cus_test',
    planId: 'plan_test',
    policy: { maxRetries: 3, ussdEnabled: true, graceHours: 72, baseDelayMinutes: 60, maxDelayHours: 72 },
    retryCount: 0,
  };
}

describe('RailOrchestrator', () => {
  let nomba: MockNombaClient;
  let orchestrator: RailOrchestrator;

  beforeEach(() => {
    nomba = new MockNombaClient();
    orchestrator = new RailOrchestrator({ nomba, logger: silentLogger });
  });

  describe('attemptCharge', () => {
    it('delegates to nomba.chargeCard and surfaces success', async () => {
      const result = await orchestrator.attemptCharge({
        context: makeContext(),
        paymentMethodToken: 'tok_test',
        amount: 5000,
        idempotencyKey: 'sub_test:cycle_1:attempt_1',
      });
      expect(result.status).toBe('succeeded');
    });

    it('surfaces failure including retryable flag', async () => {
      const result = await orchestrator.attemptCharge({
        context: makeContext(),
        paymentMethodToken: 'tok_test',
        amount: 5000,
        idempotencyKey: 'sub_test:expired:1',
      });
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.retryable).toBe(false);
      }
    });
  });

  describe('createVirtualAccount', () => {
    it('passes invoice ID as reference and currency NGN', async () => {
      const spy = vi.spyOn(nomba, 'createVirtualAccount');
      await orchestrator.createVirtualAccount({
        context: makeContext(),
        amount: 5000,
        invoiceId: 'inv_42',
        expiresInDays: 7,
      });
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'inv_42',
          amount: 5000,
          currency: 'NGN',
          expiresInDays: 7,
        }),
      );
    });
  });

  describe('sendUSSDPush', () => {
    it('returns the USSD code when supported', async () => {
      const result = await orchestrator.sendUSSDPush({
        context: makeContext(),
        amount: 5000,
        invoiceId: 'inv_42',
        customerBankCode: '058',
        customerPhone: '+2348012345678',
      });
      expect(result.ussdCode).toMatch(/^\*402\*\d{4}#$/);
    });

    it('propagates UnsupportedRailError so the wrapper can advance to WhatsApp', async () => {
      const ussdDisabled = new MockNombaClient({ ussdAvailable: false });
      const o = new RailOrchestrator({ nomba: ussdDisabled, logger: silentLogger });
      await expect(
        o.sendUSSDPush({
          context: makeContext(),
          amount: 5000,
          invoiceId: 'inv_42',
          customerBankCode: '058',
          customerPhone: '+2348012345678',
        }),
      ).rejects.toBeInstanceOf(UnsupportedRailError);
    });
  });

  describe('sendWhatsAppRecovery', () => {
    it('is a stub — logs a warning and returns', async () => {
      const result = await orchestrator.sendWhatsAppRecovery({
        context: makeContext(),
        invoiceId: 'inv_42',
      });
      expect(result).toBeUndefined();
      expect(silentLogger.warn).toHaveBeenCalled();
    });
  });
});
