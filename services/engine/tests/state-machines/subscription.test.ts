// services/engine/tests/state-machines/subscription.test.ts
//
// Pure state machine tests. No DB, no Nomba, no IO.
// These run in <100ms total and don't need docker-compose up.

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  subscriptionMachine,
  type SubscriptionContext,
  type DunningPolicy,
} from '../../src/state-machines/subscription.js';

const defaultPolicy: DunningPolicy = {
  maxRetries: 3,
  ussdEnabled: true,
  graceHours: 72,
  baseDelayMinutes: 60,
  maxDelayHours: 72,
};

function makeContext(overrides: Partial<SubscriptionContext> = {}): SubscriptionContext {
  return {
    subscriptionId: 'sub_test_123',
    merchantId: 'mer_test_123',
    customerId: 'cus_test_123',
    planId: 'plan_test_123',
    policy: defaultPolicy,
    retryCount: 0,
    ...overrides,
  };
}

function start(context: SubscriptionContext) {
  const actor = createActor(subscriptionMachine, { input: context });
  actor.start();
  return actor;
}

describe('subscription state machine', () => {
  describe('happy paths', () => {
    it('routes through trial: pending -> trialing -> charging -> active', () => {
      const actor = start(makeContext());

      expect(actor.getSnapshot().value).toBe('pending');

      actor.send({ type: 'START_TRIAL' });
      expect(actor.getSnapshot().value).toBe('trialing');

      actor.send({ type: 'TRIAL_ENDED' });
      expect(actor.getSnapshot().value).toBe('charging');

      actor.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('routes no-trial signup: pending -> charging -> active', () => {
      const actor = start(makeContext());

      actor.send({ type: 'START_BILLING' });
      expect(actor.getSnapshot().value).toBe('charging');

      actor.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('renews from active on cycle boundary and records the invoice', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });

      actor.send({ type: 'CYCLE_BOUNDARY_REACHED', invoiceId: 'inv_42' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('charging');
      expect(snapshot.context.currentInvoiceId).toBe('inv_42');
      expect(snapshot.context.retryCount).toBe(0);
    });
  });

  describe('retry pipeline', () => {
    it('enters retrying on retryable failure with retries remaining', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });

      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('retrying');
      expect(snapshot.context.retryCount).toBe(1);
      expect(snapshot.context.lastFailureReason).toBe('insufficient_funds');
    });

    it('returns to charging on RETRY_DUE and increments retry count on next failure', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });

      actor.send({ type: 'RETRY_DUE' });
      expect(actor.getSnapshot().value).toBe('charging');

      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('retrying');
      expect(snapshot.context.retryCount).toBe(2);
    });

    it('jumps straight to va_fallback on non-retryable failure even with retries remaining', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });

      actor.send({ type: 'CHARGE_FAILED', reason: 'card_expired', retryable: false });

      expect(actor.getSnapshot().value).toBe('va_fallback');
    });

    it('falls through to va_fallback after max retries are exhausted', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 2 } }));
      actor.send({ type: 'START_BILLING' });

      // Attempt 1
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('retrying');
      actor.send({ type: 'RETRY_DUE' });

      // Attempt 2
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('retrying');
      actor.send({ type: 'RETRY_DUE' });

      // Attempt 3 — retries now exhausted
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });

      expect(actor.getSnapshot().value).toBe('va_fallback');
    });
  });

  describe('full cascade', () => {
    it('charging -> retrying -> charging -> va_fallback -> active recovers via VA credit', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 1 } }));
      actor.send({ type: 'START_BILLING' });

      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('retrying');

      actor.send({ type: 'RETRY_DUE' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('va_fallback');

      actor.send({
        type: 'VA_CREATED',
        vaId: 'va_abc',
        expiresAt: '2026-07-01T00:00:00Z',
      });
      expect(actor.getSnapshot().context.vaId).toBe('va_abc');

      actor.send({ type: 'VA_CREDITED', amount: 5000 });
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('active');
      expect(snapshot.context.retryCount).toBe(0);
    });

    it('full quad-rail: va_fallback -> ussd_fallback -> whatsapp_fallback -> past_due', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('va_fallback');

      actor.send({ type: 'VA_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('ussd_fallback');

      actor.send({ type: 'USSD_TIMEOUT' });
      expect(actor.getSnapshot().value).toBe('whatsapp_fallback');

      actor.send({ type: 'GRACE_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('past_due');
    });
  });

  describe('tri-rail mode (USSD disabled)', () => {
    it('skips USSD and goes va_fallback -> whatsapp_fallback on VA expiry', () => {
      const actor = start(
        makeContext({ policy: { ...defaultPolicy, ussdEnabled: false, maxRetries: 0 } }),
      );
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('va_fallback');

      actor.send({ type: 'VA_EXPIRED' });

      expect(actor.getSnapshot().value).toBe('whatsapp_fallback');
    });
  });

  describe('recovery from each rail', () => {
    it('ussd_fallback -> active on USSD_PAID', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      actor.send({ type: 'VA_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('ussd_fallback');

      actor.send({ type: 'USSD_PAID' });
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('whatsapp_fallback -> active on WHATSAPP_PAID', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      actor.send({ type: 'VA_EXPIRED' });
      actor.send({ type: 'USSD_TIMEOUT' });
      expect(actor.getSnapshot().value).toBe('whatsapp_fallback');

      actor.send({ type: 'WHATSAPP_PAID' });
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('past_due -> active on PAYMENT_RECORDED (out-of-band recovery)', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      actor.send({ type: 'VA_EXPIRED' });
      actor.send({ type: 'USSD_TIMEOUT' });
      actor.send({ type: 'GRACE_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('past_due');

      actor.send({ type: 'PAYMENT_RECORDED' });
      expect(actor.getSnapshot().value).toBe('active');
    });
  });

  describe('pause and resume', () => {
    it('active -> paused -> active', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });

      actor.send({ type: 'PAUSE_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('paused');

      actor.send({ type: 'RESUME_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('active');
    });

    it('pause is not reachable from charging or any cascade state', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });

      // Try to pause from charging — should be ignored (no transition defined)
      actor.send({ type: 'PAUSE_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('charging');

      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      actor.send({ type: 'PAUSE_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('retrying');
    });
  });

  describe('cancellation', () => {
    it('can cancel from any non-final state', () => {
      const states: Array<{ name: string; setup: () => ReturnType<typeof start> }> = [
        {
          name: 'pending',
          setup: () => start(makeContext()),
        },
        {
          name: 'trialing',
          setup: () => {
            const a = start(makeContext());
            a.send({ type: 'START_TRIAL' });
            return a;
          },
        },
        {
          name: 'active',
          setup: () => {
            const a = start(makeContext());
            a.send({ type: 'START_BILLING' });
            a.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });
            return a;
          },
        },
        {
          name: 'charging',
          setup: () => {
            const a = start(makeContext());
            a.send({ type: 'START_BILLING' });
            return a;
          },
        },
        {
          name: 'retrying',
          setup: () => {
            const a = start(makeContext());
            a.send({ type: 'START_BILLING' });
            a.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
            return a;
          },
        },
        {
          name: 'va_fallback',
          setup: () => {
            const a = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
            a.send({ type: 'START_BILLING' });
            a.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
            return a;
          },
        },
      ];

      for (const { name, setup } of states) {
        const actor = setup();
        expect(actor.getSnapshot().value).toBe(name);

        actor.send({ type: 'CANCEL_REQUESTED', actor: 'customer', reason: 'no longer needed' });
        expect(actor.getSnapshot().value).toBe('cancelled');
        expect(actor.getSnapshot().status).toBe('done');
      }
    });

    it('cancelled is a final state — events after cancel are ignored', () => {
      const actor = start(makeContext());
      actor.send({ type: 'CANCEL_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('cancelled');

      // Suppress XState's expected warning about sending to a stopped actor —
      // sending the event IS the assertion here.
      const originalError = console.error;
      console.error = () => {};
      try {
        actor.send({ type: 'START_BILLING' });
      } finally {
        console.error = originalError;
      }
      expect(actor.getSnapshot().value).toBe('cancelled');
    });
  });

  describe('context tracking', () => {
    it('resets retry count when recovery succeeds via any rail', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 3 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      actor.send({ type: 'RETRY_DUE' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().context.retryCount).toBe(2);

      actor.send({ type: 'RETRY_DUE' });
      actor.send({ type: 'CHARGE_SUCCEEDED', chargeId: 'chg_1' });

      expect(actor.getSnapshot().context.retryCount).toBe(0);
    });
  });

  describe('refund during dunning', () => {
    it('refund from retrying goes to refunded final state', () => {
      const actor = start(makeContext());
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true });
      expect(actor.getSnapshot().value).toBe('retrying');

      actor.send({ type: 'REFUND_REQUESTED', actor: 'merchant', reason: 'customer complaint' });
      expect(actor.getSnapshot().value).toBe('refunded');
      expect(actor.getSnapshot().status).toBe('done');
    });

    it('refund from va_fallback goes to refunded', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'card_expired', retryable: false });
      expect(actor.getSnapshot().value).toBe('va_fallback');

      actor.send({ type: 'REFUND_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('refunded');
    });

    it('refund from ussd_fallback goes to refunded', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0 } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'card_expired', retryable: false });
      actor.send({ type: 'VA_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('ussd_fallback');

      actor.send({ type: 'REFUND_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('refunded');
    });

    it('refund from whatsapp_fallback goes to refunded', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0, ussdEnabled: false } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'card_expired', retryable: false });
      actor.send({ type: 'VA_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('whatsapp_fallback');

      actor.send({ type: 'REFUND_REQUESTED', actor: 'merchant' });
      expect(actor.getSnapshot().value).toBe('refunded');
    });

    it('refund from past_due goes to refunded', () => {
      const actor = start(makeContext({ policy: { ...defaultPolicy, maxRetries: 0, ussdEnabled: false } }));
      actor.send({ type: 'START_BILLING' });
      actor.send({ type: 'CHARGE_FAILED', reason: 'card_expired', retryable: false });
      actor.send({ type: 'VA_EXPIRED' });
      actor.send({ type: 'GRACE_EXPIRED' });
      expect(actor.getSnapshot().value).toBe('past_due');

      actor.send({ type: 'REFUND_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('refunded');
    });

    it('refunded is a final state — events after refund are ignored', () => {
      const actor = start(makeContext());
      actor.send({ type: 'REFUND_REQUESTED', actor: 'customer' });
      expect(actor.getSnapshot().value).toBe('refunded');

      const originalError = console.error;
      console.error = () => {};
      try {
        actor.send({ type: 'START_BILLING' });
      } finally {
        console.error = originalError;
      }
      expect(actor.getSnapshot().value).toBe('refunded');
    });
  });
});
