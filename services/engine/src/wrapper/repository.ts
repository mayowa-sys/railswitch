// services/engine/src/wrapper/repository.ts
//
// Repository interface for the subscription wrapper.
//
// The wrapper depends ONLY on this interface. Two implementations live
// elsewhere:
//   - InMemorySubscriptionRepository (test seam, in tests/)
//   - DrizzleSubscriptionRepository  (production, lands when Daniel's
//                                      schema is merged)
//
// All methods that touch the database operate inside a transaction
// scope supplied by withTransaction. The wrapper never calls BEGIN /
// COMMIT itself — it asks the repo for a transactional scope and runs
// its logic inside.

import type { AuditEntry, SubscriptionContext } from '../state-machines/subscription.js';

/**
 * Persisted row shape — wider than SubscriptionContext because it carries
 * the current state name and the policy-link reference. The wrapper
 * hydrates an actor from this and writes a new version back.
 */
export interface SubscriptionRow {
  context: SubscriptionContext;
  /** Current state of the machine, e.g. 'active', 'va_fallback', 'past_due'. */
  state: string;
  /** Monotonically increasing version for optimistic concurrency on persist. */
  version: number;
}

/**
 * Cached result of a previously-processed event, returned verbatim on
 * idempotent replay.
 */
export interface ProcessedEventResult {
  state: string;
  context: SubscriptionContext;
}

/**
 * The transactional scope. The repo passes this to the wrapper's callback.
 * In production this is a Drizzle transaction handle; in tests it's a
 * simple object. The wrapper treats it as opaque.
 */
export interface TxScope {
  readonly __brand: 'TxScope';
}

export interface SubscriptionRepository {
  /**
   * Runs `fn` inside a transaction. The repo is responsible for BEGIN /
   * COMMIT / ROLLBACK. Errors thrown inside `fn` must roll back.
   */
  withTransaction<T>(fn: (tx: TxScope) => Promise<T>): Promise<T>;

  /**
   * Loads a subscription with a row-level lock (SELECT ... FOR UPDATE).
   * Throws SubscriptionNotFoundError if the ID doesn't exist.
   */
  loadForUpdate(tx: TxScope, subscriptionId: string): Promise<SubscriptionRow>;

  /**
   * Persists the new state + context back to the row. Throws
   * StaleVersionError if `expectedVersion` doesn't match the row's
   * current version (defense in depth on top of the row lock).
   */
  persist(
    tx: TxScope,
    subscriptionId: string,
    state: string,
    context: SubscriptionContext,
    expectedVersion: number,
  ): Promise<void>;

  /**
   * Appends an immutable audit log entry.
   */
  writeAuditEntry(tx: TxScope, entry: AuditEntry): Promise<void>;

  /**
   * Returns the cached result if the (subscription, key) pair has been
   * processed before; null otherwise. Used at the top of processEvent
   * to short-circuit duplicate webhook deliveries.
   */
  findProcessedEvent(
    tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
  ): Promise<ProcessedEventResult | null>;

  /**
   * Records that a (subscription, key) pair has been processed, with the
   * resulting state + context for replay.
   */
  recordProcessedEvent(
    tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
    result: ProcessedEventResult,
  ): Promise<void>;
}

export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription not found: ${subscriptionId}`);
    this.name = 'SubscriptionNotFoundError';
  }
}

export class StaleVersionError extends Error {
  constructor(subscriptionId: string, expected: number, actual: number) {
    super(`Stale version for ${subscriptionId}: expected ${expected}, got ${actual}`);
    this.name = 'StaleVersionError';
  }
}
