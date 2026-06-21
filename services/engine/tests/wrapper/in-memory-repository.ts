// services/engine/tests/wrapper/in-memory-repository.ts
//
// Test seam. Implements SubscriptionRepository without any database.
// Mirrors the contract of the future Drizzle impl: transactions roll
// back on error, audit entries persist atomically with state, etc.

import type { AuditEntry, SubscriptionContext } from '../../src/state-machines/subscription.js';
import type {
  ProcessedEventResult,
  SubscriptionRepository,
  SubscriptionRow,
  TxScope,
} from '../../src/wrapper/repository.js';
import {
  SubscriptionNotFoundError,
  StaleVersionError,
} from '../../src/wrapper/repository.js';

interface SnapshotState {
  rows: Map<string, SubscriptionRow>;
  auditLog: AuditEntry[];
  processedEvents: Map<string, ProcessedEventResult>;
}

const TX: TxScope = { __brand: 'TxScope' } as TxScope;

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private state: SnapshotState = {
    rows: new Map(),
    auditLog: [],
    processedEvents: new Map(),
  };

  /** Seed a subscription row for tests. */
  seed(subscriptionId: string, row: SubscriptionRow): void {
    this.state.rows.set(subscriptionId, structuredClone(row));
  }

  /** Read-only access for assertions. */
  getRow(subscriptionId: string): SubscriptionRow | undefined {
    const row = this.state.rows.get(subscriptionId);
    return row ? structuredClone(row) : undefined;
  }

  getAuditLog(): AuditEntry[] {
    return structuredClone(this.state.auditLog);
  }

  /** Track lock acquisition for tests that assert on concurrency. */
  loadCount = 0;

  async withTransaction<T>(fn: (tx: TxScope) => Promise<T>): Promise<T> {
    // Snapshot current state for rollback-on-error semantics.
    const snapshot: SnapshotState = {
      rows: new Map(
        Array.from(this.state.rows.entries()).map(([k, v]) => [k, structuredClone(v)]),
      ),
      auditLog: structuredClone(this.state.auditLog),
      processedEvents: new Map(
        Array.from(this.state.processedEvents.entries()).map(([k, v]) => [
          k,
          structuredClone(v),
        ]),
      ),
    };
    try {
      return await fn(TX);
    } catch (err) {
      this.state = snapshot; // rollback
      throw err;
    }
  }

  async loadForUpdate(_tx: TxScope, subscriptionId: string): Promise<SubscriptionRow> {
    this.loadCount += 1;
    const row = this.state.rows.get(subscriptionId);
    if (!row) throw new SubscriptionNotFoundError(subscriptionId);
    return structuredClone(row);
  }

  async persist(
    _tx: TxScope,
    subscriptionId: string,
    state: string,
    context: SubscriptionContext,
    expectedVersion: number,
  ): Promise<void> {
    const current = this.state.rows.get(subscriptionId);
    if (!current) throw new SubscriptionNotFoundError(subscriptionId);
    if (current.version !== expectedVersion) {
      throw new StaleVersionError(subscriptionId, expectedVersion, current.version);
    }
    this.state.rows.set(subscriptionId, {
      state,
      context: structuredClone(context),
      version: current.version + 1,
    });
  }

  async writeAuditEntry(_tx: TxScope, entry: AuditEntry): Promise<void> {
    this.state.auditLog.push(structuredClone(entry));
  }

  async findProcessedEvent(
    _tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
  ): Promise<ProcessedEventResult | null> {
    const key = `${subscriptionId}::${idempotencyKey}`;
    const result = this.state.processedEvents.get(key);
    return result ? structuredClone(result) : null;
  }

  async recordProcessedEvent(
    _tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
    result: ProcessedEventResult,
  ): Promise<void> {
    const key = `${subscriptionId}::${idempotencyKey}`;
    this.state.processedEvents.set(key, structuredClone(result));
  }
}
