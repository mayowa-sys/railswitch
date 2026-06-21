// services/engine/src/rails/mock-nomba-client.ts
//
// Deterministic mock implementation of NombaClient.
//
// Failure injection is driven by the idempotencyKey content, NOT by random
// chance. Tests must be reproducible; demos must be reliable.
//
// CONVENTIONS
// -----------
// idempotencyKey contains the substring...
//   "ok"          -> success
//   "insufficient" -> failed, insufficient_funds, retryable=true
//   "expired"     -> failed, card_expired, retryable=false
//   "declined"    -> failed, card_declined, retryable=false
//   "network"     -> failed, network_error, retryable=true
//   "limit"       -> failed, limit_exceeded, retryable=true
// (no match)      -> success (default to happy path)
//
// USSD: throws UnsupportedRailError if constructed with { ussdAvailable: false }.

import type {
  ChargeFailureReason,
  ChargeResult,
  NombaClient,
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
}

export class MockNombaClient implements NombaClient {
  private readonly ussdAvailable: boolean;
  private readonly now: () => Date;
  private readonly seenIdempotencyKeys = new Map<string, ChargeResult>();
  private counter = 0;

  constructor(opts: MockNombaClientOptions = {}) {
    this.ussdAvailable = opts.ussdAvailable ?? true;
    this.now = opts.now ?? (() => new Date());
  }

  async chargeCard(
    token: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<ChargeResult> {
    // Idempotency: same key returns the cached result.
    const cached = this.seenIdempotencyKeys.get(idempotencyKey);
    if (cached) return cached;

    const failure = FAILURE_PATTERNS.find((p) => idempotencyKey.includes(p.match));
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

    this.seenIdempotencyKeys.set(idempotencyKey, result);
    return result;
  }

  async createVirtualAccount(opts: VirtualAccountOptions): Promise<VirtualAccountResult> {
    // Mock acknowledges all fields but only uses expiresInDays to compute expiry.
    // The real client will encode amount, reference, and beneficiaryName into the
    // Nomba VA creation request.
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
    // Mock acknowledges all fields but only enforces the availability flag.
    // The real client will encode amount, reference, bank code, and phone
    // into the Nomba USSD push request.
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

  // ---------- test helpers ----------

  /** Returns the number of times a given idempotency key has been seen. */
  hasSeenKey(key: string): boolean {
    return this.seenIdempotencyKeys.has(key);
  }

  /** Clears idempotency cache. For tests that want to simulate a fresh client. */
  reset(): void {
    this.seenIdempotencyKeys.clear();
    this.counter = 0;
  }

  // ---------- internals ----------

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_mock_${this.counter.toString().padStart(6, '0')}`;
  }

  private fakeAccountNumber(): string {
    // 10-digit NUBAN-shaped number. Not a real account.
    return Math.floor(1_000_000_000 + Math.random() * 9_000_000_000).toString();
  }
}
