import { sql, eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { AuditLog } from '../schema/audit_log.schema.js';
import { ProcessedEventsTable } from '../schema/processed_events.schema.js';
import type { AuditEntry, SubscriptionContext } from '../state-machines/subscription.js';
import type {
  ProcessedEventResult,
  SubscriptionRepository,
  SubscriptionRow,
  TxScope,
} from '../wrapper/repository.js';
import {
  SubscriptionNotFoundError,
  StaleVersionError,
} from '../wrapper/repository.js';

const TX_KEY = '__drizzleTx';

function unwrapTx(scope: TxScope) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (scope as any)[TX_KEY];
}

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly db: NodePgDatabase,
    private readonly merchantId: string,
  ) {}

  async withTransaction<T>(fn: (tx: TxScope) => Promise<T>): Promise<T> {
    return this.db.transaction(async (drizzleTx) => {
      await drizzleTx.execute(
        sql`SELECT set_config('app.current_merchant_id', ${this.merchantId}, true)`,
      );
      const scope = { __brand: 'TxScope' as const, [TX_KEY]: drizzleTx };
      return fn(scope);
    });
  }

  async loadForUpdate(tx: TxScope, subscriptionId: string): Promise<SubscriptionRow> {
    const drizzleTx = unwrapTx(tx);
    const rows = await drizzleTx
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, subscriptionId),
          eq(SubscriptionsTable.merchant_id, this.merchantId),
        ),
      )
      .for('update');

    if (rows.length === 0) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    const row = rows[0];
    return {
      state: row.state,
      version: row.version,
      context: rowToContext(row),
    };
  }

  async persist(
    tx: TxScope,
    subscriptionId: string,
    state: string,
    context: SubscriptionContext,
    expectedVersion: number,
  ): Promise<void> {
    const drizzleTx = unwrapTx(tx);

    const current = await drizzleTx
      .select({ version: SubscriptionsTable.version })
      .from(SubscriptionsTable)
      .where(
        and(
          eq(SubscriptionsTable.id, subscriptionId),
          eq(SubscriptionsTable.merchant_id, this.merchantId),
        ),
      )
      .for('update');

    if (current.length === 0) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (current[0].version !== expectedVersion) {
      throw new StaleVersionError(subscriptionId, expectedVersion, current[0].version);
    }

    await drizzleTx
      .update(SubscriptionsTable)
      .set({
        state: state as typeof SubscriptionsTable.$inferInsert.state,
        version: expectedVersion + 1,
        retry_count: context.retryCount,
        last_failure_reason: context.lastFailureReason ?? null,
        last_failure_retryable: context.lastFailureRetryable ?? null,
        va_id: context.vaId ?? null,
        va_expires_at: context.vaExpiresAt ? new Date(context.vaExpiresAt) : null,
        current_invoice_id: context.currentInvoiceId ?? null,
      })
      .where(
        and(
          eq(SubscriptionsTable.id, subscriptionId),
          eq(SubscriptionsTable.merchant_id, this.merchantId),
        ),
      );
  }

  async writeAuditEntry(tx: TxScope, entry: AuditEntry): Promise<void> {
    const drizzleTx = unwrapTx(tx);
    await drizzleTx.insert(AuditLog).values({
      merchant_id: entry.merchantId,
      subscription_id: entry.subscriptionId,
      from_state: entry.fromState as typeof AuditLog.$inferInsert.from_state,
      to_state: entry.toState as typeof AuditLog.$inferInsert.to_state,
      actor: entry.actor as typeof AuditLog.$inferInsert.actor,
      reason: entry.reason,
      timestamp: new Date(entry.timestamp),
    });
  }

  async findProcessedEvent(
    tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
  ): Promise<ProcessedEventResult | null> {
    const drizzleTx = unwrapTx(tx);
    const rows = await drizzleTx
      .select()
      .from(ProcessedEventsTable)
      .where(
        and(
          eq(ProcessedEventsTable.subscription_id, subscriptionId),
          eq(ProcessedEventsTable.idempotency_key, idempotencyKey),
          eq(ProcessedEventsTable.merchant_id, this.merchantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      state: row.cached_state,
      context: row.cached_context as unknown as SubscriptionContext,
    };
  }

  async recordProcessedEvent(
    tx: TxScope,
    subscriptionId: string,
    idempotencyKey: string,
    result: ProcessedEventResult,
  ): Promise<void> {
    const drizzleTx = unwrapTx(tx);
    await drizzleTx.insert(ProcessedEventsTable).values({
      merchant_id: this.merchantId,
      subscription_id: subscriptionId,
      idempotency_key: idempotencyKey,
      cached_state: result.state as typeof ProcessedEventsTable.$inferInsert.cached_state,
      cached_context: result.context as unknown as typeof ProcessedEventsTable.$inferInsert.cached_context,
    });
  }
}

function rowToContext(row: typeof SubscriptionsTable.$inferSelect): SubscriptionContext {
  return {
    subscriptionId: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    planId: row.plan_id,
    policy: row.policy,
    retryCount: row.retry_count,
    lastFailureReason: row.last_failure_reason ?? undefined,
    lastFailureRetryable: row.last_failure_retryable ?? undefined,
    vaId: row.va_id ?? undefined,
    vaExpiresAt: row.va_expires_at?.toISOString() ?? undefined,
    currentInvoiceId: row.current_invoice_id ?? undefined,
  };
}
