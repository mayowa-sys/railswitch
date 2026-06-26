// services/engine/src/state-machines/subscription.ts
//
// RailSwitch subscription lifecycle state machine.
//
// SCOPE
// -----
// Pure state graph. No IO, no DB, no Nomba. All side effects
// (audit-log writes, charge attempts, VA creation, USSD pushes,
// WhatsApp sends) are the responsibility of the wrapper that owns
// the actor instance.
//
// WRAPPER RESPONSIBILITIES (separate file, not yet written)
// ---------------------------------------------------------
// - BEGIN TRANSACTION, SELECT subscription FOR UPDATE
// - Check idempotency key against processed_events table
// - createActor(subscriptionMachine, { input: subscription })
// - actor.subscribe(snapshot => writeAuditRow(prev -> next))
// - actor.send(event)
// - Persist actor.getSnapshot().context back to subscriptions table
// - COMMIT
//
// CASCADE
// -------
// charging   -- CHARGE_FAILED + retryable + retries_remaining --> retrying
// charging   -- CHARGE_FAILED + (!retryable || exhausted)     --> va_fallback
// retrying   -- RETRY_DUE                                     --> charging  (loop)
// va_fallback   -- VA_EXPIRED + ussdEnabled                   --> ussd_fallback
// va_fallback   -- VA_EXPIRED + !ussdEnabled                  --> whatsapp_fallback (tri-rail)
// ussd_fallback -- USSD_TIMEOUT                               --> whatsapp_fallback
// whatsapp_fallback -- GRACE_EXPIRED                          --> past_due
//
// Any state can transition to `cancelled` on CANCEL_REQUESTED.
// Recovery from any rail back to `active` happens on the rail's
// success event (VA_CREDITED, USSD_PAID, WHATSAPP_PAID).
//
// TEST SCENARIOS (separate test file)
// -----------------------------------
// - Happy path:        pending -> trialing -> charging -> active
// - Full cascade:      charging -> retrying -> charging -> va_fallback -> active
// - Tri-rail:          va_fallback -> whatsapp_fallback (skips USSD)
// - Cancel mid-flow:   va_fallback -> cancelled
// - Pause and resume:  active -> paused -> active
// - Past-due recovery: whatsapp_fallback -> past_due -> active

import { setup, assign } from 'xstate';

// ---------- Domain types ----------

export type Actor = 'system' | 'merchant' | 'customer';

export interface DunningPolicy {
  /** Max retry attempts after the initial charge fails. 0 = no retries. */
  maxRetries: number;
  /** When true, va_fallback -> ussd_fallback on VA expiry. When false, skips to WhatsApp (tri-rail). */
  ussdEnabled: boolean;
  /** Hours to wait in past_due before auto-cancelling. */
  graceHours: number;
  /** Base delay between retries in minutes. Exponential backoff multiplies this. Default 60. */
  baseDelayMinutes: number;
  /** Cap on computed retry delay in hours. Default 72. */
  maxDelayHours: number;
}

export interface SubscriptionContext {
  subscriptionId: string;
  merchantId: string;
  customerId: string;
  planId: string;
  policy: DunningPolicy;

  // Runtime state
  retryCount: number;
  lastFailureReason?: string;
  lastFailureRetryable?: boolean;
  vaId?: string;
  vaExpiresAt?: string;
  currentInvoiceId?: string;
}

export type SubscriptionEvent =
  // Initial routing
  | { type: 'START_TRIAL' }
  | { type: 'START_BILLING' }

  // Lifecycle
  | { type: 'TRIAL_ENDED' }
  | { type: 'CYCLE_BOUNDARY_REACHED'; invoiceId: string }

  // Charge outcomes
  | { type: 'CHARGE_SUCCEEDED'; chargeId: string }
  | { type: 'CHARGE_FAILED'; reason: string; retryable: boolean }

  // Retry pipeline
  | { type: 'RETRY_DUE' }
  | { type: 'RETRIES_EXHAUSTED' }

  // VA pipeline
  | { type: 'VA_CREATED'; vaId: string; expiresAt: string }
  | { type: 'VA_CREDITED'; amount: number }
  | { type: 'VA_EXPIRED' }

  // USSD pipeline
  | { type: 'USSD_PAID' }
  | { type: 'USSD_TIMEOUT' }

  // WhatsApp pipeline
  | { type: 'WHATSAPP_PAID' }
  | { type: 'GRACE_EXPIRED' }

  // Past-due
  | { type: 'PAYMENT_RECORDED' }
  | { type: 'DUNNING_EXHAUSTED' }

  // Intent from customer or merchant
  | { type: 'PAUSE_REQUESTED'; actor: Actor }
  | { type: 'RESUME_REQUESTED'; actor: Actor }
  | { type: 'CANCEL_REQUESTED'; actor: Actor; reason?: string }
  | { type: 'REFUND_REQUESTED'; actor: Actor; reason?: string };

// ---------- Audit log contract (consumed by the wrapper) ----------

export interface AuditEntry {
  merchantId: string;
  subscriptionId: string;
  fromState: string;
  toState: string;
  actor: Actor;
  reason: string;
  timestamp: string;
}

// ---------- Machine ----------

export const subscriptionMachine = setup({
  types: {
    context: {} as SubscriptionContext,
    events: {} as SubscriptionEvent,
    input: {} as SubscriptionContext,
  },

  guards: {
    isRetryable: ({ context, event }) =>
      event.type === 'CHARGE_FAILED' &&
      event.retryable &&
      context.retryCount < context.policy.maxRetries,

    isExhaustedOrNonRetryable: ({ context, event }) =>
      event.type === 'CHARGE_FAILED' &&
      (!event.retryable || context.retryCount >= context.policy.maxRetries),

    ussdEnabled: ({ context }) => context.policy.ussdEnabled,
    ussdDisabled: ({ context }) => !context.policy.ussdEnabled,
  },

  actions: {
    incrementRetryCount: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),

    resetRetryCount: assign({
      retryCount: 0,
    }),

    recordFailure: assign(({ event }) => {
      if (event.type !== 'CHARGE_FAILED') return {};
      return {
        lastFailureReason: event.reason,
        lastFailureRetryable: event.retryable,
      };
    }),

    recordVA: assign(({ event }) => {
      if (event.type !== 'VA_CREATED') return {};
      return {
        vaId: event.vaId,
        vaExpiresAt: event.expiresAt,
      };
    }),

    recordInvoice: assign(({ event }) => {
      if (event.type !== 'CYCLE_BOUNDARY_REACHED') return {};
      return { currentInvoiceId: event.invoiceId };
    }),
  },
}).createMachine({
  id: 'subscription',
  initial: 'pending',
  context: ({ input }) => input,

  states: {
    pending: {
      on: {
        START_TRIAL: { target: 'trialing' },
        START_BILLING: { target: 'charging' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    trialing: {
      on: {
        TRIAL_ENDED: { target: 'charging' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    active: {
      on: {
        CYCLE_BOUNDARY_REACHED: {
          target: 'charging',
          actions: ['recordInvoice', 'resetRetryCount'],
        },
        PAUSE_REQUESTED: { target: 'paused' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    charging: {
      on: {
        CHARGE_SUCCEEDED: {
          target: 'active',
          actions: 'resetRetryCount',
        },
        CHARGE_FAILED: [
          {
            target: 'retrying',
            guard: 'isRetryable',
            actions: ['recordFailure', 'incrementRetryCount'],
          },
          {
            target: 'va_fallback',
            guard: 'isExhaustedOrNonRetryable',
            actions: 'recordFailure',
          },
        ],
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    retrying: {
      on: {
        RETRY_DUE: { target: 'charging' },
        RETRIES_EXHAUSTED: { target: 'va_fallback' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    va_fallback: {
      on: {
        VA_CREATED: { actions: 'recordVA' },
        VA_CREDITED: {
          target: 'active',
          actions: 'resetRetryCount',
        },
        VA_EXPIRED: [
          { target: 'ussd_fallback', guard: 'ussdEnabled' },
          { target: 'whatsapp_fallback', guard: 'ussdDisabled' },
        ],
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    ussd_fallback: {
      on: {
        USSD_PAID: {
          target: 'active',
          actions: 'resetRetryCount',
        },
        USSD_TIMEOUT: { target: 'whatsapp_fallback' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    whatsapp_fallback: {
      on: {
        WHATSAPP_PAID: {
          target: 'active',
          actions: 'resetRetryCount',
        },
        GRACE_EXPIRED: { target: 'past_due' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    paused: {
      on: {
        RESUME_REQUESTED: { target: 'active' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    past_due: {
      on: {
        PAYMENT_RECORDED: {
          target: 'active',
          actions: 'resetRetryCount',
        },
        DUNNING_EXHAUSTED: { target: 'cancelled' },
        CANCEL_REQUESTED: { target: 'cancelled' },
        REFUND_REQUESTED: { target: 'refunded' },
      },
    },

    refunded: {
      type: 'final',
    },

    cancelled: {
      type: 'final',
    },
  },
});

export type SubscriptionMachine = typeof subscriptionMachine;
