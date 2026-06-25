// services/engine/src/rails/mock-nomba-client.ts
//
// Deterministic mock implementation of NombaClient.
//
// Failure injection is driven by the merchantTxRef content, NOT by random
// chance. Tests must be reproducible; demos must be reliable.
//
// CONVENTIONS
// -----------
// merchantTxRef contains the substring...
//   "ok"            -> success
//   "insufficient"  -> failed, insufficient_funds, retryable=true
//   "expired"       -> failed, card_expired, retryable=false
//   "declined"      -> failed, card_declined, retryable=false
//   "network"       -> failed, network_error, retryable=true
//   "limit"         -> failed, limit_exceeded, retryable=true
// (no match)        -> success (default to happy path)
//
// USSD: throws UnsupportedRailError if constructed with { ussdAvailable: false }.

import type {
  BankLookupResult,
  ChargeCardOptions,
  ChargeFailureReason,
  ChargeResult,
  NombaClient,
  TransferOptions,
  TransferResult,
  USSDOptions,
  USSDResult,
  VirtualAccountOptions,
  VirtualAccountResult,
} from './nomba-client.js';
import { UnsupportedRailError } from './nomba-client.js';

interface FailurePattern {
  match: string;
  reason: ChargeFailureReason;
  retryable: boolean;
}

const FAILURE_PATTERNS: FailurePattern[] = [
  { match: 'insufficient', reason: 'insufficient_funds', retryable: true },
  { match: 'expired',      reason: 'card_expired',       retryable: false },
  { match: 'declined',     reason: 'card_declined',      retryable: false },
  { match: 'network',      reason: 'network_error',      retryable: true },
  { match: 'limit',        reason: 'limit_exceeded',     retryable: true },
];

export interface MockNombaClientOptions {
  /** When false, triggerUSSD throws UnsupportedRailError. Default: true. */
  ussdAvailable?: boolean;
  /** Frozen-clock support for tests. Defaults to Date.now(). */
  now?: () => Date;
  /** Predefined bank lookup responses keyed by account number. */
  bankLookups?: Record<string, BankLookupResult>;
}

export class MockNombaClient implements NombaClient {
  private readonly ussdAvailable: boolean;
  private readonly now: () => Date;
  private readonly bankLookups: Record<string, BankLookupResult>;
  private readonly seenCharges = new Map<string, ChargeResult>();
  private readonly revokedTokens = new Set<string>();
  private counter = 0;

  constructor(opts: MockNombaClientOptions = {}) {
    this.ussdAvailable = opts.ussdAvailable ?? true;
    this.now = opts.now ?? (() => new Date());
    this.bankLookups = opts.bankLookups ?? {};
  }

  async chargeCard(opts: ChargeCardOptions): Promise<ChargeResult> {
    const { token, amount, currency, customerId, merchantTxRef } = opts;
    void token;
    void currency;
    void customerId;

    // Idempotency: same merchantTxRef returns the cached result.
    const cached = this.seenCharges.get(merchantTxRef);
    if (cached) return cached;

    const failure = FAILURE_PATTERNS.find((p) => merchantTxRef.includes(p.match));
    const processedAt = this.now().toISOString();

    const result: ChargeResult = failure
      ? {
          status: 'failed',
          reason: failure.reason,
          retryable: failure.retryable,
          processedAt,
          attemptRef: this.nextId('att'),
        }
      : {
          status: 'succeeded',
          chargeId: this.nextId('chg'),
          amount,
          currency: 'NGN',
          processedAt,
        };

    this.seenCharges.set(merchantTxRef, result);
    return result;
  }

  async createVirtualAccount(opts: VirtualAccountOptions): Promise<VirtualAccountResult> {
    const { amount, reference, beneficiaryName, expiresInDays } = opts;
    void amount;
    void reference;
    void beneficiaryName;

    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + expiresInDays * 86_400_000);
    return {
      vaId: this.nextId('va'),
      accountNumber: this.fakeAccountNumber(),
      bankName: 'Mock Bank',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async triggerUSSD(opts: USSDOptions): Promise<USSDResult> {
    const { amount, reference, customerBankCode, customerPhone } = opts;
    void amount;
    void reference;
    void customerBankCode;
    void customerPhone;

    if (!this.ussdAvailable) {
      throw new UnsupportedRailError('ussd');
    }
    const expiresAt = new Date(this.now().getTime() + 15 * 60_000);
    return {
      ussdId: this.nextId('ussd'),
      ussdCode: `*402*${Math.floor(1000 + Math.random() * 9000)}#`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revokeCardToken(tokenId: string): Promise<void> {
    this.revokedTokens.add(tokenId);
  }

  async lookupBankAccount(bankCode: string, accountNumber: string): Promise<BankLookupResult> {
    // Check predefined lookups first (for deterministic tests).
    const predefined = this.bankLookups[accountNumber];
    if (predefined) return predefined;

    return {
      accountName: 'Mock Account Holder',
      accountNumber,
      bankCode,
      bankName: `Mock Bank (${bankCode})`,
    };
  }

  async sendTransfer(opts: TransferOptions): Promise<TransferResult> {
    const { amount, bankCode, accountNumber, accountName, senderName, narration, merchantTxRef } = opts;
    void amount;
    void bankCode;
    void accountNumber;
    void accountName;
    void senderName;
    void narration;
    void merchantTxRef;

    return {
      transferId: this.nextId('xfer'),
      status: 'success',
      processedAt: this.now().toISOString(),
      nombaTransferRef: this.nextId('nomx'),
    };
  }

  // ---------- test helpers ----------

  /** Returns whether a given merchantTxRef has been seen by chargeCard. */
  hasSeenKey(key: string): boolean {
    return this.seenCharges.has(key);
  }

  /** Returns whether a token has been revoked. */
  isTokenRevoked(tokenId: string): boolean {
    return this.revokedTokens.has(tokenId);
  }

  /** Clears all internal state. For tests that want a fresh client. */
  reset(): void {
    this.seenCharges.clear();
    this.revokedTokens.clear();
    this.counter = 0;
  }

  // ---------- internals ----------

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_mock_${this.counter.toString().padStart(6, '0')}`;
  }

  private fakeAccountNumber(): string {
    return Math.floor(1_000_000_000 + Math.random() * 9_000_000_000).toString();
  }
}
