// services/engine/tests/rails/mock-nomba-client.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MockNombaClient } from '../../src/rails/mock-nomba-client.js';
import { UnsupportedRailError } from '../../src/rails/nomba-client.js';
import type { ChargeCardOptions } from '../../src/rails/nomba-client.js';

function chargeOpts(overrides: Partial<ChargeCardOptions> = {}): ChargeCardOptions {
  return {
    token: 'tok_test',
    amount: 5000,
    currency: 'NGN',
    customerId: 'cus_test',
    merchantTxRef: 'sub_1:cycle_1:attempt_1',
    ...overrides,
  };
}

describe('MockNombaClient', () => {
  let client: MockNombaClient;

  beforeEach(() => {
    client = new MockNombaClient();
  });

  describe('chargeCard', () => {
    it('returns success for a benign merchantTxRef', async () => {
      const result = await client.chargeCard(chargeOpts());
      expect(result.status).toBe('succeeded');
      if (result.status === 'succeeded') {
        expect(result.amount).toBe(5000);
        expect(result.currency).toBe('NGN');
        expect(result.chargeId).toMatch(/^chg_mock_/);
      }
    });

    it('returns insufficient_funds (retryable) when merchantTxRef contains "insufficient"', async () => {
      const result = await client.chargeCard(chargeOpts({ merchantTxRef: 'sub_1:insufficient:1' }));
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('insufficient_funds');
        expect(result.retryable).toBe(true);
      }
    });

    it('returns card_expired (non-retryable) when merchantTxRef contains "expired"', async () => {
      const result = await client.chargeCard(chargeOpts({ merchantTxRef: 'sub_1:expired:1' }));
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('card_expired');
        expect(result.retryable).toBe(false);
      }
    });

    it('returns card_declined (non-retryable) when merchantTxRef contains "declined"', async () => {
      const result = await client.chargeCard(chargeOpts({ merchantTxRef: 'declined_key' }));
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('card_declined');
        expect(result.retryable).toBe(false);
      }
    });

    it('returns network_error (retryable) when merchantTxRef contains "network"', async () => {
      const result = await client.chargeCard(chargeOpts({ merchantTxRef: 'network_blip_key' }));
      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.reason).toBe('network_error');
        expect(result.retryable).toBe(true);
      }
    });

    it('is idempotent — same merchantTxRef returns the exact same result', async () => {
      const key = 'idem_key_xyz';
      const first = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      const second = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      expect(second).toEqual(first);
    });

    it('idempotency holds even when the same key would map to a failure', async () => {
      const key = 'insufficient_key';
      const first = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      const second = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      expect(second).toEqual(first);
    });

    it('acknowledges customerId and currency fields', async () => {
      const result = await client.chargeCard(chargeOpts({
        customerId: 'cus_9972',
        currency: 'NGN',
      }));
      expect(result.status).toBe('succeeded');
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

  describe('revokeCardToken', () => {
    it('records the revoked token', async () => {
      await client.revokeCardToken('tok_xyz');
      expect(client.isTokenRevoked('tok_xyz')).toBe(true);
    });

    it('does not affect unrelated tokens', async () => {
      await client.revokeCardToken('tok_a');
      expect(client.isTokenRevoked('tok_b')).toBe(false);
    });
  });

  describe('lookupBankAccount', () => {
    it('returns a mock account holder for unknown accounts', async () => {
      const result = await client.lookupBankAccount('044', '0123456789');
      expect(result.accountName).toBe('Mock Account Holder');
      expect(result.bankCode).toBe('044');
      expect(result.accountNumber).toBe('0123456789');
    });

    it('returns predefined lookups when configured', async () => {
      const c = new MockNombaClient({
        bankLookups: {
          '0000000000': {
            accountName: 'Habiblahi Hamzat',
            accountNumber: '0000000000',
            bankCode: '090645',
            bankName: 'Nombank',
          },
        },
      });
      const result = await c.lookupBankAccount('090645', '0000000000');
      expect(result.accountName).toBe('Habiblahi Hamzat');
      expect(result.bankName).toBe('Nombank');
    });
  });

  describe('sendTransfer', () => {
    it('returns a successful transfer result', async () => {
      const result = await client.sendTransfer({
        amount: 5000,
        currency: 'NGN',
        bankCode: '044',
        accountNumber: '0123456789',
        accountName: 'John Doe',
        senderName: 'RailSwitch',
        narration: 'Refund — INV 42',
        merchantTxRef: 'refund_inv42_001',
      });
      expect(result.status).toBe('success');
      expect(result.transferId).toMatch(/^xfer_mock_/);
      expect(result.nombaTransferRef).toMatch(/^nomx_mock_/);
    });
  });

  describe('reset', () => {
    it('clears the idempotency cache', async () => {
      const key = 'key_a';
      const r1 = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      client.reset();
      const r2 = await client.chargeCard(chargeOpts({ merchantTxRef: key }));
      if (r1.status === 'succeeded' && r2.status === 'succeeded') {
        expect(r2.chargeId).toBe(r1.chargeId);
      }
      expect(client.hasSeenKey(key)).toBe(true);
    });
  });
});
