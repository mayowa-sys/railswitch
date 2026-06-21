// services/engine/tests/wrapper/subscription-wrapper.test.ts

import { describe, it, expect, vi } from 'vitest';
import { SubscriptionWrapper } from '../../src/wrapper/subscription-wrapper.js';
import { InMemorySubscriptionRepository } from './in-memory-repository.js';
import type {
  SubscriptionContext,
  DunningPolicy,
} from '../../src/state-machines/subscription.js';

const fixedNow = new Date('2026-06-21T12:00:00Z');
const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const policy: DunningPolicy = {
  maxRetries: 3,
  ussdEnabled: true,
  graceHours: 72,
  baseDelayMinutes: 60,
  maxDelayHours: 72,
};

function makeContext(): SubscriptionContext {
  return {
    subscriptionId: 'sub_1',
    merchantId: 'mer_1',
    customerId: 'cus_1',
    planId: 'plan_1',
    policy,
    retryCount: 0,
  };
}

function makeWrapper() {
  const repo = new InMemorySubscriptionRepository();
  const wrapper = new SubscriptionWrapper({
    repo,
    logger: silentLogger,
    now: () => fixedNow,
  });
  return { repo, wrapper };
}

describe('SubscriptionWrapper.processEvent', () => {
  describe('happy paths', () => {
    it('transitions pending -> trialing and writes an audit row', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      const result = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_1',
      });

      expect(result.state).toBe('trialing');
      expect(result.cached).toBe(false);

      const row = repo.getRow('sub_1');
      expect(row?.state).toBe('trialing');
      expect(row?.version).toBe(2);

      const audit = repo.getAuditLog();
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        subscriptionId: 'sub_1',
        merchantId: 'mer_1',
        fromState: 'pending',
        toState: 'trialing',
        actor: 'system',
        reason: 'START_TRIAL',
        timestamp: fixedNow.toISOString(),
      });
    });

    it('attributes actor=customer for customer-initiated events', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'PAUSE_REQUESTED', actor: 'customer' },
        idempotencyKey: 'evt_pause',
      });

      const audit = repo.getAuditLog();
      expect(audit[0].actor).toBe('customer');
    });

    it('attributes actor=merchant for merchant-initiated cancels', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'CANCEL_REQUESTED', actor: 'merchant', reason: 'non-payment' },
        idempotencyKey: 'evt_cancel',
      });

      const audit = repo.getAuditLog();
      expect(audit[0].actor).toBe('merchant');
      expect(audit[0].toState).toBe('cancelled');
    });
  });

  describe('idempotency', () => {
    it('replays the same idempotency key returns the cached result without re-running', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      const first = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_dup',
      });
      const versionAfterFirst = repo.getRow('sub_1')?.version;

      const second = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_dup',
      });

      expect(second.state).toBe(first.state);
      expect(second.cached).toBe(true);
      // Row version unchanged — no second persist happened
      expect(repo.getRow('sub_1')?.version).toBe(versionAfterFirst);
      // Only one audit row
      expect(repo.getAuditLog()).toHaveLength(1);
    });

    it('different idempotency keys produce separate transitions', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_a',
      });
      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'TRIAL_ENDED' },
        idempotencyKey: 'evt_b',
      });

      expect(repo.getRow('sub_1')?.state).toBe('charging');
      expect(repo.getAuditLog()).toHaveLength(2);
    });
  });

  describe('no-op transitions', () => {
    it('does not write an audit row when the event does not change state', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'active', context: makeContext(), version: 1 });

      // PAUSE_REQUESTED is valid from active; but try sending TRIAL_ENDED
      // (ignored from active — no transition defined)
      const result = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'TRIAL_ENDED' },
        idempotencyKey: 'evt_noop',
      });

      expect(result.state).toBe('active');
      expect(repo.getAuditLog()).toHaveLength(0);
    });
  });

  describe('cascade integration', () => {
    it('processes a charge_failed event and routes to retrying', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'charging', context: makeContext(), version: 5 });

      const result = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'CHARGE_FAILED', reason: 'insufficient_funds', retryable: true },
        idempotencyKey: 'evt_fail_1',
      });

      expect(result.state).toBe('retrying');
      expect(result.context.retryCount).toBe(1);
      expect(result.context.lastFailureReason).toBe('insufficient_funds');

      const audit = repo.getAuditLog();
      expect(audit[0]).toMatchObject({
        fromState: 'charging',
        toState: 'retrying',
        reason: 'CHARGE_FAILED',
      });
    });

    it('persists context updates from machine actions (recordVA)', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'va_fallback', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'VA_CREATED', vaId: 'va_xyz', expiresAt: '2026-07-01T00:00:00Z' },
        idempotencyKey: 'evt_va_create',
      });

      const row = repo.getRow('sub_1');
      expect(row?.context.vaId).toBe('va_xyz');
      expect(row?.context.vaExpiresAt).toBe('2026-07-01T00:00:00Z');
      // State unchanged — VA_CREATED only updates context
      expect(row?.state).toBe('va_fallback');
      // No audit row — no state transition
      expect(repo.getAuditLog()).toHaveLength(0);
    });
  });

  describe('transaction semantics', () => {
    it('rolls back state, audit, and idempotency on persist failure', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      // Force a stale-version error by mutating version mid-flight
      const originalPersist = repo.persist.bind(repo);
      repo.persist = async () => {
        throw new Error('simulated persist failure');
      };

      await expect(
        wrapper.processEvent({
          subscriptionId: 'sub_1',
          event: { type: 'START_TRIAL' },
          idempotencyKey: 'evt_rollback',
        }),
      ).rejects.toThrow('simulated persist failure');

      // Restore for assertions
      repo.persist = originalPersist;

      // Row unchanged
      expect(repo.getRow('sub_1')?.state).toBe('pending');
      expect(repo.getRow('sub_1')?.version).toBe(1);
      // No audit row
      expect(repo.getAuditLog()).toHaveLength(0);
      // Idempotency key NOT recorded — replay must re-attempt
      const replay = await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_rollback',
      });
      expect(replay.cached).toBe(false);
      expect(replay.state).toBe('trialing');
    });
  });

  describe('row locking', () => {
    it('acquires the row lock exactly once per event', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_lock_1',
      });
      expect(repo.loadCount).toBe(1);

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'TRIAL_ENDED' },
        idempotencyKey: 'evt_lock_2',
      });
      expect(repo.loadCount).toBe(2);
    });

    it('skips the row lock on idempotent replay (cache hit short-circuits)', async () => {
      const { repo, wrapper } = makeWrapper();
      repo.seed('sub_1', { state: 'pending', context: makeContext(), version: 1 });

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_replay',
      });
      expect(repo.loadCount).toBe(1);

      await wrapper.processEvent({
        subscriptionId: 'sub_1',
        event: { type: 'START_TRIAL' },
        idempotencyKey: 'evt_replay',
      });
      // No additional load — cache hit returned before loadForUpdate
      expect(repo.loadCount).toBe(1);
    });
  });
});
