// services/engine/src/rails/nomba-client.ts
//
// NombaClient interface and shared types.
//
// IMPORTANT
// ---------
// This file defines OUR interface. It is not a wrapper around Nomba's SDK.
// The real implementation (lands July 1+) translates between this interface
// and Nomba's actual API. Until then, only the mock implements it.
//
// Method signatures are driven by what the rail orchestrator needs, not by
// what Nomba happens to expose. This keeps us in control of our own surface.

export type ChargeFailureReason =
  | 'insufficient_funds'
  | 'card_expired'
  | 'card_declined'
  | 'network_error'
  | 'bank_unavailable'
  | 'limit_exceeded'
  | 'unknown';

export interface ChargeSucceeded {
  status: 'succeeded';
  chargeId: string;
  amount: number;
  currency: 'NGN';
  processedAt: string;
}

export interface ChargeFailed {
  status: 'failed';
  reason: ChargeFailureReason;
  retryable: boolean;
  processedAt: string;
  /** Nomba's reference for this attempt, for support correlation. */
  attemptRef?: string;
}

export type ChargeResult = ChargeSucceeded | ChargeFailed;

export interface VirtualAccountOptions {
  amount: number;
  currency: 'NGN';
  /** Our invoice ID — becomes the reference Nomba echoes back on credit. */
  reference: string;
  /** How long the VA stays live. Past this, transfers are rejected. */
  expiresInDays: number;
  /** Display name shown to the payer in their banking app. */
  beneficiaryName: string;
}

export interface VirtualAccountResult {
  vaId: string;
  accountNumber: string;
  bankName: string;
  expiresAt: string;
}

export interface USSDOptions {
  amount: number;
  currency: 'NGN';
  reference: string;
  customerBankCode: string;
  customerPhone: string;
}

export interface USSDResult {
  ussdId: string;
  ussdCode: string;
  expiresAt: string;
}

export interface NombaClient {
  /**
   * Charge a tokenized card. Must be idempotent — same idempotencyKey returns
   * the same result, never double-charges.
   */
  chargeCard(
    token: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<ChargeResult>;

  /**
   * Create a one-time virtual account scoped to a single invoice.
   * Amount-locked: transfers of the wrong amount are rejected.
   */
  createVirtualAccount(opts: VirtualAccountOptions): Promise<VirtualAccountResult>;

  /**
   * Trigger a USSD payment push. Availability TBD on July 1 —
   * orchestrator falls through to WhatsApp if this throws UnsupportedRailError.
   */
  triggerUSSD(opts: USSDOptions): Promise<USSDResult>;
}

export class UnsupportedRailError extends Error {
  constructor(rail: string) {
    super(`Rail not supported: ${rail}`);
    this.name = 'UnsupportedRailError';
  }
}
