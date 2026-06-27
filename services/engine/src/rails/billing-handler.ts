import { SubscriptionWrapper, type ProcessEventResult } from '../wrapper/subscription-wrapper.js';
import { RailOrchestrator } from './orchestrator.js';
import type { SubscriptionContext } from '../state-machines/subscription.js';

export interface BillingInput {
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  paymentMethodToken: string;
  idempotencyKey: string;
}

export type BillingStatus = 'paid' | 'failed' | 'already_processing';

export interface BillingResult {
  status: BillingStatus;
  state: string;
  context: SubscriptionContext;
  reason?: string;
}

export class BillingHandler {
  constructor(
    private readonly wrapper: SubscriptionWrapper,
    private readonly orchestrator: RailOrchestrator,
  ) {}

  async bill(input: BillingInput): Promise<BillingResult> {
    const { subscriptionId, invoiceId, amount, paymentMethodToken, idempotencyKey } = input;

    const cycleResult = await this.wrapper.processEvent({
      subscriptionId,
      event: { type: 'CYCLE_BOUNDARY_REACHED', invoiceId },
      idempotencyKey: `${idempotencyKey}:cycle`,
    });

    if (cycleResult.cached) {
      return this.handleCachedCycle(cycleResult);
    }

    return this.attemptCharge(subscriptionId, paymentMethodToken, amount, cycleResult.context, idempotencyKey);
  }

  private handleCachedCycle(result: ProcessEventResult): BillingResult {
    const state = result.state;
    if (state === 'active' || state === 'trialing' || state === 'paused') {
      return { status: 'paid', state, context: result.context };
    }
    return { status: 'already_processing', state, context: result.context };
  }

  async retry(input: BillingInput): Promise<BillingResult> {
    const { subscriptionId, amount, paymentMethodToken, idempotencyKey } = input;

    const retryResult = await this.wrapper.processEvent({
      subscriptionId,
      event: { type: 'RETRY_DUE' },
      idempotencyKey: `${idempotencyKey}:retry`,
    });

    if (retryResult.cached) {
      return this.handleCachedCycle(retryResult);
    }

    if (retryResult.state === 'charging') {
      return this.attemptCharge(subscriptionId, paymentMethodToken, amount, retryResult.context, idempotencyKey);
    }

    return { status: 'already_processing', state: retryResult.state, context: retryResult.context };
  }

  private async attemptCharge(
    subscriptionId: string,
    paymentMethodToken: string,
    amount: number,
    context: SubscriptionContext,
    idempotencyKey: string,
  ): Promise<BillingResult> {
    const chargeResult = await this.orchestrator.attemptCharge({
      context,
      paymentMethodToken,
      amount,
      idempotencyKey: `${idempotencyKey}:charge`,
    });

    if (chargeResult.status === 'succeeded') {
      const result = await this.wrapper.processEvent({
        subscriptionId,
        event: { type: 'CHARGE_SUCCEEDED', chargeId: chargeResult.chargeId },
        idempotencyKey: `${idempotencyKey}:succeeded`,
      });
      return { status: 'paid', state: result.state, context: result.context };
    }

    const result = await this.wrapper.processEvent({
      subscriptionId,
      event: {
        type: 'CHARGE_FAILED',
        reason: chargeResult.reason,
        retryable: chargeResult.retryable,
      },
      idempotencyKey: `${idempotencyKey}:failed`,
    });
    return { status: 'failed', state: result.state, context: result.context, reason: chargeResult.reason };
  }
}
