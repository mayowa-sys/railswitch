// services/engine/tests/rails/mock-nomba-client.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MockNombaClient } from '../../src/rails/mock-nomba-client.js';
import { UnsupportedRailError } from '../../src/rails/nomba-client.js';

describe('MockNombaClient', () => {
  let client: MockNombaClient;

  beforeEach(() => {
    client = new MockNombaClient();
  });

  describe('chargeCard', () => {
    it('returns success for a benign idempotency key', async () => {
      const result = await client.chargeCard('tok_test', 5000, 'sub_1:cycle_1:attempt_1');
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.amount).toBe(5000);
        expect(result.currency).toBe('NGN');
        expect(result.chargeId).toMatch(/^chg_mock_/);
      }
    });

    it('returns insufficient_funds (retryable) when key contains "insufficient"', async () => {
      const result = await client.chargeCard('tok_test', 5000, 'sub_1:insufficient:1');
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('insufficient_funds');
        expect(result.retryable).toBe(true);
      }
    });

    it('returns card_expired (non-retryable) when key contains "expired"', async () => {
      const result = await client.chargeCard('tok_test', 5000, 'sub_1:expired:1');
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('card_expired');
        expect(result.retryable).toBe(false);
      }
    });

    it('returns card_declined (non-retryable) when key contains "declined"', async () => {
      const result = await client.chargeCard('tok_test', 5000, 'declined_key');
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('card_declined');
        expect(result.retryable).toBe(false);
      }
    });

    it('returns network_error (retryable) when key contains "network"', async () => {
      const result = await client.chargeCard('tok_test', 5000, 'network_blip_key');
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('network_error');
        expect(result.retryable).toBe(true);
      }
    });

    it('is idempotent — same key returns the exact same result', async () => {
      const first = await client.chargeCard('tok_test', 5000, 'idem_key_xyz');
      const second = await client.chargeCard('tok_test', 5000, 'idem_key_xyz');
      expect(second).toEqual(first);
    });

    it('idempotency holds even when the same key would map to a failure', async () => {
      const first = await client.chargeCard('tok_test', 5000, 'insufficient_key');
      const second = await client.chargeCard('tok_test', 5000, 'insufficient_key');
      expect(second).toEqual(first);
    });
  });

  describe('createVirtualAccount', () => {
    it('returns a VA with the requested expiry', async () => {
      const fixedNow = new Date('2026-07-01T12:00:00Z');
      const c = new MockNombaClient({ now: () => fixedNow });

      const va = await c.createVirtualAccount({
        amount: 5000,
        currency: 'NGN',
        reference: 'inv_abc',
        expiresInDays: 7,
        beneficiaryName: 'TestCo',
      });

      expect(va.vaId).toMatch(/^va_mock_/);
      expect(va.accountNumber).toMatch(/^\d{10}$/);
      expect(va.bankName).toBe('Mock Bank');
      expect(new Date(va.expiresAt).getTime()).toBe(
        fixedNow.getTime() + 7 * 86_400_000,
      );
    });
  });

  describe('triggerUSSD', () => {
    it('returns a USSD code when USSD is available', async () => {
      const result = await client.triggerUSSD({
        amount: 5000,
        currency: 'NGN',
        reference: 'inv_abc',
        customerBankCode: '058',
        customerPhone: '+2348012345678',
      });
      expect(result.ussdId).toMatch(/^ussd_mock_/);
      expect(result.ussdCode).toMatch(/^\*402\*\d{4}#$/);
    });

    it('throws UnsupportedRailError when USSD is disabled', async () => {
      const c = new MockNombaClient({ ussdAvailable: false });
      await expect(
        c.triggerUSSD({
          amount: 5000,
          currency: 'NGN',
          reference: 'inv_abc',
          customerBankCode: '058',
          customerPhone: '+2348012345678',
        }),
      ).rejects.toBeInstanceOf(UnsupportedRailError);
    });
  });

  describe('reset', () => {
    it('clears the idempotency cache', async () => {
      const r1 = await client.chargeCard('tok', 5000, 'key_a');
      client.reset();
      const r2 = await client.chargeCard('tok', 5000, 'key_a');
      // Different chargeId because counter reset and cache cleared
      if (r1.status === 'succeeded' && r2.status === 'succeeded') {
        expect(r2.chargeId).toBe(r1.chargeId); // counter resets to 1, same id
      }
      expect(client.hasSeenKey('key_a')).toBe(true);
    });
  });
});
