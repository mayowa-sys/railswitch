// services/engine/src/rails/orchestrator.ts
//
// Rail orchestrator scaffold.
//
// RESPONSIBILITY
// --------------
// Translates state machine entry events into rail-specific actions, and
// translates rail outcomes (success, failure, webhook receipt) back into
// state machine events.
//
// SCOPE OF THIS FILE (pre-window)
// -------------------------------
// Method stubs and the dependency-injection shape. No real cascade wiring,
// no retry timing, no webhook listeners. Each method logs what it would do
// and returns. The full implementation lands in the window phase.
//
// IMPORTANT
// ---------
// Like the state machine, this is internal-only logic. The orchestrator
// does not perform DB writes — it asks the wrapper (separate, not yet
// written) to persist the resulting state machine events.

import type { NombaClient } from './nomba-client.js';
import type { SubscriptionContext } from '../state-machines/subscription.js';

export interface OrchestratorLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: OrchestratorLogger = {
  info: (msg, meta) => console.log(`[orchestrator] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[orchestrator] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[orchestrator] ${msg}`, meta ?? ''),
};

export interface OrchestratorDeps {
  nomba: NombaClient;
  logger?: OrchestratorLogger;
}

export interface AttemptChargeInput {
  context: SubscriptionContext;
  paymentMethodToken: string;
  amount: number;
  /** Unique per (subscription, cycle, retry-attempt). */
  idempotencyKey: string;
}

export interface CreateVAInput {
  context: SubscriptionContext;
  amount: number;
  invoiceId: string;
  expiresInDays: number;
}

export interface SendUSSDInput {
  context: SubscriptionContext;
  amount: number;
  invoiceId: string;
  customerBankCode: string;
  customerPhone: string;
}

export class RailOrchestrator {
  private readonly nomba: NombaClient;
  private readonly logger: OrchestratorLogger;

  constructor(deps: OrchestratorDeps) {
    this.nomba = deps.nomba;
    this.logger = deps.logger ?? consoleLogger;
  }

  /**
   * Called when the state machine enters `charging`. Attempts the card charge
   * via Nomba and returns the result. The wrapper translates the result into
   * a CHARGE_SUCCEEDED or CHARGE_FAILED event and sends it to the actor.
   */
  async attemptCharge(input: AttemptChargeInput) {
    this.logger.info('attemptCharge', {
      subscriptionId: input.context.subscriptionId,
      idempotencyKey: input.idempotencyKey,
      retryCount: input.context.retryCount,
    });
    return this.nomba.chargeCard(
      input.paymentMethodToken,
      input.amount,
      input.idempotencyKey,
    );
  }

  /**
   * Called when the state machine enters `va_fallback`. Creates a one-time VA
   * scoped to this invoice. The wrapper persists vaId / expiresAt to context
   * via the VA_CREATED event.
   */
  async createVirtualAccount(input: CreateVAInput) {
    this.logger.info('createVirtualAccount', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });
    return this.nomba.createVirtualAccount({
      amount: input.amount,
      currency: 'NGN',
      reference: input.invoiceId,
      expiresInDays: input.expiresInDays,
      beneficiaryName: `RailSwitch-${input.context.merchantId.slice(0, 8)}`,
    });
  }

  /**
   * Called when the state machine enters `ussd_fallback`. Triggers a USSD
   * push. If the underlying client throws UnsupportedRailError, the wrapper
   * is expected to immediately advance the machine to `whatsapp_fallback`.
   */
  async sendUSSDPush(input: SendUSSDInput) {
    this.logger.info('sendUSSDPush', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });
    return this.nomba.triggerUSSD({
      amount: input.amount,
      currency: 'NGN',
      reference: input.invoiceId,
      customerBankCode: input.customerBankCode,
      customerPhone: input.customerPhone,
    });
  }

  /**
   * Called when the state machine enters `whatsapp_fallback`. Sends a
   * templated WhatsApp message with VA details + USSD code + checkout link.
   * Real implementation lands in the window phase (WhatsApp Cloud API).
   */
  async sendWhatsAppRecovery(input: { context: SubscriptionContext; invoiceId: string }) {
    this.logger.warn('sendWhatsAppRecovery is a stub — WhatsApp integration is a window-phase task', {
      subscriptionId: input.context.subscriptionId,
      invoiceId: input.invoiceId,
    });
  }
}
