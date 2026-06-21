// services/engine/src/wrapper/subscription-wrapper.ts
//
// The transactional wrapper around the subscription state machine.
//
// RESPONSIBILITIES
// ----------------
// 1. Idempotency: short-circuit duplicate event deliveries by checking
//    the processed_events log before doing any work.
// 2. Concurrency: hold a row-level lock on the subscription for the
//    duration of the transition. The repo's loadForUpdate handles this.
// 3. State integrity: hydrate an actor at the row's current state, run
//    the event through it, persist the result. All inside one transaction.
// 4. Audit log: write an audit row for every state transition the event
//    causes, in the same transaction as the state persistence. Atomic.
//
// NON-RESPONSIBILITIES
// --------------------
// - Doesn't talk to Nomba. The orchestrator does, in response to actor
//   transitions. Side effects from actor transitions (charge, VA creation,
//   USSD push) are dispatched OUTSIDE the transaction by a higher layer.
// - Doesn't define what a "transaction" is. That's the repo's problem.
// - Doesn't know about HTTP. The gateway calls into this, not the other
//   way around.

import { createActor } from 'xstate';
import {
  subscriptionMachine,
  type SubscriptionContext,
  type SubscriptionEvent,
  type AuditEntry,
  type Actor as AuditActor,
} from '../state-machines/subscription.js';
import type { ProcessedEventResult, SubscriptionRepository } from './repository.js';

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: Logger = {
  info: (msg, meta) => console.log(`[wrapper] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[wrapper] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[wrapper] ${msg}`, meta ?? ''),
};

export interface SubscriptionWrapperDeps {
  repo: SubscriptionRepository;
  logger?: Logger;
  /** Test seam for timestamps in audit rows. */
  now?: () => Date;
}

export interface ProcessEventInput {
  subscriptionId: string;
  event: SubscriptionEvent;
  /** Idempotency key from the inbound webhook or gateway request. */
  idempotencyKey: string;
}

export interface ProcessEventResult {
  state: string;
  context: SubscriptionContext;
  /** True if the result came from the idempotency cache. */
  cached: boolean;
}

export class SubscriptionWrapper {
  private readonly repo: SubscriptionRepository;
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor(deps: SubscriptionWrapperDeps) {
    this.repo = deps.repo;
    this.logger = deps.logger ?? consoleLogger;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Processes one event against the subscription state machine, with
   * row-level locking, idempotency, and audit logging — all in one
   * transaction.
   */
  async processEvent(input: ProcessEventInput): Promise<ProcessEventResult> {
    const { subscriptionId, event, idempotencyKey } = input;

    return this.repo.withTransaction(async (tx) => {
      // 1. Idempotency check
      const cached = await this.repo.findProcessedEvent(tx, subscriptionId, idempotencyKey);
      if (cached) {
        this.logger.info('idempotent replay', { subscriptionId, idempotencyKey });
        return { state: cached.state, context: cached.context, cached: true };
      }

      // 2. Load with row lock
      const row = await this.repo.loadForUpdate(tx, subscriptionId);

      // 3. Hydrate actor at the row's current state + context
      const actor = createActor(subscriptionMachine, {
        input: row.context,
        snapshot: subscriptionMachine.resolveState({
          value: row.state,
          context: row.context,
        }),
      });

      const auditActor = extractAuditActor(event);
      const fromState = row.state;
      const transitions: AuditEntry[] = [];

      // 4. Subscribe BEFORE start to catch the transition
      const subscription = actor.subscribe((snapshot) => {
        const toState = String(snapshot.value);
        if (toState !== fromState && transitions.length === 0) {
          transitions.push({
            merchantId: row.context.merchantId,
            subscriptionId,
            fromState,
            toState,
            actor: auditActor,
            reason: event.type,
            timestamp: this.now().toISOString(),
          });
        }
      });

      // 5. Start and send
      actor.start();
      actor.send(event);
      subscription.unsubscribe();

      const snapshot = actor.getSnapshot();
      const newState = String(snapshot.value);
      const newContext = snapshot.context;

      // 6. Write audit entries
      for (const entry of transitions) {
        await this.repo.writeAuditEntry(tx, entry);
      }

      // 7. Persist new state + context
      await this.repo.persist(tx, subscriptionId, newState, newContext, row.version);

      // 8. Record idempotency
      const result: ProcessedEventResult = { state: newState, context: newContext };
      await this.repo.recordProcessedEvent(tx, subscriptionId, idempotencyKey, result);

      return { state: newState, context: newContext, cached: false };
    });
  }
}

/**
 * Extracts the audit actor from an event. Customer/merchant intents carry
 * the actor explicitly; everything else (charge outcomes, VA credits,
 * timer expirations) is system-driven.
 */
function extractAuditActor(event: SubscriptionEvent): AuditActor {
  if ('actor' in event) {
    return event.actor;
  }
  return 'system';
}
