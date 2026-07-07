// services/engine/src/rails/real-nomba-client.ts
//
// Production NombaClient implementation — landed July 1 2026.
// Translates between RailSwitch's NombaClient interface and Nomba's REST API.
//
// Auth: OAuth 2.0 client_credentials. Token cached in-memory, refreshed at
// the 55-minute mark (tokens are valid for 60 minutes). accountId header
// required on every request per Nomba docs.
//
// Amounts: Nomba uses kobo. This client multiplies our amounts (₦) by 100
// before sending and divides Nomba amounts by 100 on receipt.

import type {
  NombaClient,
  ChargeCardOptions,
  ChargeResult,
  VirtualAccountOptions,
  VirtualAccountResult,
  USSDOptions,
  USSDResult,
  BankLookupResult,
  TransferOptions,
  TransferResult,
} from './nomba-client.js';
import { UnsupportedRailError } from './nomba-client.js';
import { GlobalLogger } from '../utils/logger.js';

const TOKEN_REFRESH_MARGIN_MS = 55 * 60 * 1000; // refresh at 55 min
const TOKEN_VALIDITY_MS = 60 * 60 * 1000; // 1 hour

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class RealNombaClient implements NombaClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountId: string;
  private readonly subAccountId: string;
  private readonly logger: GlobalLogger;
  private tokenCache: CachedToken | null = null;

  constructor(opts: {
    clientId: string;
    clientSecret: string;
    accountId: string;
    subAccountId: string;
    baseUrl?: string;
  }) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.accountId = opts.accountId;
    this.subAccountId = opts.subAccountId;
    this.baseUrl = opts.baseUrl ?? 'https://sandbox.nomba.com';
    this.logger = new GlobalLogger('RealNombaClient');
  }

  // === PUBLIC API ===

  async chargeCard(opts: ChargeCardOptions): Promise<ChargeResult> {
    const body = {
      tokenKey: opts.token,
      order: {
        amount: Math.round(opts.amount * 100),
        currency: opts.currency,
        customerId: opts.customerId,
        merchantTxRef: opts.merchantTxRef,
      },
    };

    const json = await this.request('POST', '/v1/checkout/tokenized-card-payment', body);
    const charge = nombaData(json);

    if (charge.status === 'SUCCESS' || charge.status === 'success') {
      return {
        status: 'succeeded',
        chargeId: charge.reference ?? charge.id ?? opts.merchantTxRef,
        amount: opts.amount,
        currency: 'NGN',
        processedAt: charge.processedAt ?? new Date().toISOString(),
      };
    }

    const failureCode = String(charge.responseCode ?? charge.code ?? '').toLowerCase();
    const retryable = isRetryableFailure(failureCode);

    return {
      status: 'failed',
      reason: mapFailureReason(failureCode),
      retryable,
      processedAt: new Date().toISOString(),
      attemptRef: charge.reference ?? undefined,
    };
  }

  async createVirtualAccount(
    opts: VirtualAccountOptions,
  ): Promise<VirtualAccountResult> {
    const body = {
      accountRef: opts.reference,
      accountName: opts.beneficiaryName,
      amount: Math.round(opts.amount * 100),
      expiryDate: new Date(
        Date.now() + opts.expiresInDays * 86_400_000,
      )
        .toISOString()
        .split('T')[0],
    };

    const json = await this.request('POST', `/v1/accounts/virtual/${this.subAccountId}`, body);
    const va = nombaData(json);

    return {
      vaId: va.id ?? va.accountRef ?? opts.reference,
      accountNumber: va.bankAccountNumber ?? va.accountNumber,
      bankName: va.bankName ?? 'Nomba',
      expiresAt: va.expiryDate ?? '',
    };
  }

  async triggerUSSD(_opts: USSDOptions): Promise<USSDResult> {
    throw new UnsupportedRailError('USSD');
  }

  async revokeCardToken(tokenId: string): Promise<void> {
    await this.request('DELETE', `/v1/tokenized-card/${tokenId}`);
  }

  async lookupBankAccount(
    bankCode: string,
    accountNumber: string,
  ): Promise<BankLookupResult> {
    const json = await this.request('POST', '/v1/transfers/bank/lookup', {
      bankCode,
      accountNumber,
    });
    const result = nombaData(json);

    return {
      accountName: result.accountName,
      accountNumber: result.accountNumber,
      bankCode: result.bankCode ?? bankCode,
      bankName: result.bankName ?? '',
    };
  }

  async sendTransfer(opts: TransferOptions): Promise<TransferResult> {
    const body = {
      amount: Math.round(opts.amount * 100),
      bankCode: opts.bankCode,
      accountNumber: opts.accountNumber,
      accountName: opts.accountName,
      senderName: opts.senderName,
      narration: opts.narration,
      merchantTxRef: opts.merchantTxRef,
    };

    const json = await this.request('POST', '/v1/transfers/bank', body);
    const transfer = nombaData(json);

    return {
      transferId: transfer.id ?? transfer.reference ?? opts.merchantTxRef,
      status: transfer.status === 'SUCCESS' ? 'success' : 'pending',
      processedAt: transfer.processedAt ?? new Date().toISOString(),
      nombaTransferRef: transfer.reference ?? undefined,
    };
  }

  // === INTERNALS ===

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    this.logger.info('Nomba API call', {
      method,
      path,
      merchantTxRef: body && typeof body === 'object' && 'merchantTxRef' in body
        ? String((body as Record<string, unknown>).merchantTxRef)
        : undefined,
    });

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      accountId: this.accountId,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body && method !== 'GET' && method !== 'DELETE') {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let json: Record<string, unknown> = {};

    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      this.logger.error('Nomba API error', {
        method,
        path,
        status: res.status,
        body: text.substring(0, 500),
      });
      throw new Error(
        `Nomba API error (${res.status}): ${(json as Record<string, unknown>).message ?? text.substring(0, 200)}`,
      );
    }

    return json;
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.accessToken;
    }

    this.logger.info('Fetching new Nomba access token');

    const res = await fetch(`${this.baseUrl}/v1/auth/token/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId: this.accountId,
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nomba auth failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const token = (json.data as Record<string, unknown>)?.access_token as string | undefined
      ?? json.access_token as string | undefined;

    if (!token) {
      throw new Error('Nomba auth response missing access_token');
    }

    this.tokenCache = {
      accessToken: token,
      expiresAt: Date.now() + TOKEN_VALIDITY_MS - TOKEN_REFRESH_MARGIN_MS,
    };

    this.logger.info('Nomba access token refreshed');
    return token;
  }
}

// === Helpers ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NombaData = Record<string, any>;

function nombaData(json: Record<string, unknown>): NombaData {
  return (json.data ?? json) as NombaData;
}

function isRetryableFailure(code: string): boolean {
  const retryable = ['insufficient', 'network', 'timeout', 'limit', 'processing', 'unavailable'];
  return retryable.some((r) => code.includes(r));
}

function mapFailureReason(code: string): ChargeResult extends { status: 'failed'; reason: infer R } ? R : never {
  if (code.includes('insufficient')) return 'insufficient_funds' as never;
  if (code.includes('expired') || code.includes('invalid_card')) return 'card_expired' as never;
  if (code.includes('decline') || code.includes('do_not_honor')) return 'card_declined' as never;
  if (code.includes('network') || code.includes('timeout')) return 'network_error' as never;
  if (code.includes('bank') || code.includes('issuer')) return 'bank_unavailable' as never;
  if (code.includes('limit') || code.includes('exceed')) return 'limit_exceeded' as never;
  return 'unknown' as never;
}
