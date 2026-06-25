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

// -------- Charge API (Tokenized Cards — Module 06) --------

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

export interface ChargeCardOptions {
  token: string;
  amount: number;
  currency: 'NGN';
  customerId: string;
  /** Unique per (subscription, cycle, retry-attempt). Maps to Nomba's merchantTxRef. */
  merchantTxRef: string;
}

// -------- Virtual Accounts (Module 07) --------

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

// -------- USSD --------

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

// -------- Transfers (Module 09) --------

export interface BankLookupResult {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface TransferOptions {
  amount: number;
  currency: 'NGN';
  bankCode: string;
  accountNumber: string;
  accountName: string;
  senderName: string;
  narration: string;
  /** Unique per transfer attempt. */
  merchantTxRef: string;
}

export interface TransferResult {
  transferId: string;
  status: 'pending' | 'success' | 'failed';
  processedAt?: string;
  /** Nomba's reference for reconciliation. */
  nombaTransferRef?: string;
}

// -------- Client Interface --------

export interface NombaClient {
  /**
   * Charge a tokenized card via Nomba's /tokenized-card/charge.
   * Must be idempotent — same merchantTxRef returns the same result, never double-charges.
   */
  chargeCard(opts: ChargeCardOptions): Promise<ChargeResult>;

  /**
   * Create a one-time virtual account scoped to a single invoice via Nomba's /accounts/virtual.
   * Amount-locked: Nomba echoes the expected amount in the webhook payload.
   * Note: bank rails may still accept any value — handle over/under-payment in the webhook handler.
   */
  createVirtualAccount(opts: VirtualAccountOptions): Promise<VirtualAccountResult>;

  /**
   * Trigger a USSD payment push. Availability TBD on July 1 —
   * orchestrator falls through to WhatsApp if this throws UnsupportedRailError.
   */
  triggerUSSD(opts: USSDOptions): Promise<USSDResult>;

  /**
   * Revoke a stored card token via Nomba's DELETE /tokenized-card/{tokenId}.
   * Called when a customer removes a payment method.
   */
  revokeCardToken(tokenId: string): Promise<void>;

  /**
   * Resolve a bank account number to a verified account name via Nomba's /transfers/bank/lookup.
   * Required before initiating a transfer — sending to an unverified account can be irreversible.
   */
  lookupBankAccount(bankCode: string, accountNumber: string): Promise<BankLookupResult>;

  /**
   * Initiate a bank transfer via Nomba's /transfers/bank.
   * Used for refunds, payouts, and VA over-payment returns.
   */
  sendTransfer(opts: TransferOptions): Promise<TransferResult>;
}

export class UnsupportedRailError extends Error {
  constructor(rail: string) {
    super(`Rail not supported: ${rail}`);
    this.name = 'UnsupportedRailError';
  }
}
