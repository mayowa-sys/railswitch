import { describe, it, expect, vi } from 'vitest';
import { SubscriptionWrapper } from '../../src/wrapper/subscription-wrapper.js';
import { InMemorySubscriptionRepository } from '../wrapper/in-memory-repository.js';
import { RailOrchestrator } from '../../src/rails/orchestrator.js';
import { MockNombaClient } from '../../src/rails/mock-nomba-client.js';
import { BillingHandler } from '../../src/rails/billing-handler.js';
import type { SubscriptionContext } from '../../src/state-machines/subscription.js';

const fixedNow = new Date('2026-06-25T12:00:00Z');
const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeRepoAndWrapper() {
  const repo = new InMemorySubscriptionRepository();
  const wrapper = new SubscriptionWrapper({
    repo,
    logger: silentLogger,
    now: () => fixedNow,
  });
  return { repo, wrapper };
}

function makeOrchestrator(nomba?: MockNombaClient) {
  return new RailOrchestrator({
    nomba: nomba ?? new MockNombaClient(),
    logger: silentLogger,
  });
}

function makeContext(overrides: Partial<SubscriptionContext> = {}): SubscriptionContext {
  return {
    subscriptionId: 'sub_1',
    merchantId: 'mer_1',
    customerId: 'cus_1',
    planId: 'plan_1',
    policy: { maxRetries: 3, ussdEnabled: true, graceHours: 72, baseDelayMinutes: 60, maxDelayHours: 72 },
    retryCount: 0,
    ...overrides,
  };
}

function setupHandler() {
  const nomba = new MockNombaClient();
  const { repo, wrapper } = makeRepoAndWrapper();
  const orchestrator = makeOrchestrator(nomba);
  const handler = new BillingHandler(wrapper, orchestrator);
  return { repo, wrapper, orchestrator, nomba, handler };
}

describe('BillingHandler', () => {
  describe('happy path', () => {
    it('charges successfully: active -> charging -> active', async () => {
      const { repo, handler } = setupHandler();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      const result = await handler.bill({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'bill_sub_1_cycle_3',
      });

      expect(result.status).toBe('paid');
      expect(result.state).toBe('active');

      const row = repo.getRow('sub_1');
      expect(row?.state).toBe('active');
      expect(row?.version).toBe(3);
      expect(row?.context.retryCount).toBe(0);
    });


  });

  describe('charge failures', () => {
    it('enters retrying on retryable failure', async () => {
      const { repo, handler } = setupHandler();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      const result = await handler.bill({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'sub_1:insufficient:cycle_3',
      });

      expect(result.status).toBe('failed');
      expect(result.state).toBe('retrying');
      expect(result.reason).toBe('insufficient_funds');

      const row = repo.getRow('sub_1');
      expect(row?.context.retryCount).toBe(1);
      expect(row?.context.lastFailureReason).toBe('insufficient_funds');
    });

    it('enters va_fallback on non-retryable failure', async () => {
      const { repo, handler } = setupHandler();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      const result = await handler.bill({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'sub_1:expired:cycle_3',
      });

      expect(result.status).toBe('failed');
      expect(result.state).toBe('va_fallback');
      expect(result.reason).toBe('card_expired');
    });

    it('retry(): retrying -> charging -> fails -> retrying again', async () => {
      const { repo, handler } = setupHandler();
      repo.seed('sub_1', { state: 'retrying', context: makeContext({ retryCount: 1 }), version: 1 });

      const result = await handler.retry({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'sub_1:insufficient:retry_2',
      });

      expect(result.status).toBe('failed');
      expect(result.state).toBe('retrying');
      expect(result.context.retryCount).toBe(2);
    });

    it('retry(): exhausting max retries falls to va_fallback', async () => {
      const { repo, handler } = setupHandler();
      repo.seed('sub_1', {
        state: 'retrying',
        context: makeContext({ retryCount: 2, policy: { maxRetries: 2, ussdEnabled: true, graceHours: 72, baseDelayMinutes: 60, maxDelayHours: 72 } }),
        version: 1,
      });

      const result = await handler.retry({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'sub_1:insufficient:retry_3',
      });

      expect(result.status).toBe('failed');
      expect(result.state).toBe('va_fallback');
      expect(result.context.retryCount).toBe(2);
    });
  });

  describe('idempotency', () => {
    it('replay of the same idempotency key does not re-attempt the charge', async () => {
      const { repo, nomba, handler } = setupHandler();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      const chargeSpy = vi.spyOn(nomba, 'chargeCard');

      const first = await handler.bill({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'idem_key',
      });

      expect(first.status).toBe('paid');
      expect(chargeSpy).toHaveBeenCalledTimes(1);

      const second = await handler.bill({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'idem_key',
      });

      expect(second.status).toBe('already_processing');
      expect(chargeSpy).toHaveBeenCalledTimes(1);
      expect(repo.getAuditLog()).toHaveLength(2);
    });

    it('retry(): replay of same idempotency key does not re-attempt', async () => {
      const { repo, nomba, handler } = setupHandler();
      repo.seed('sub_1', { state: 'retrying', context: makeContext({ retryCount: 1 }), version: 1 });

      const chargeSpy = vi.spyOn(nomba, 'chargeCard');

      const first = await handler.retry({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'retry_idem:insufficient',
      });

      expect(first.status).toBe('failed');
      expect(chargeSpy).toHaveBeenCalledTimes(1);

      const second = await handler.retry({
        subscriptionId: 'sub_1',
        invoiceId: 'inv_42',
        amount: 5000,
        paymentMethodToken: 'tok_test',
        idempotencyKey: 'retry_idem:insufficient',
      });

      expect(second.status).toBe('already_processing');
      expect(chargeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
