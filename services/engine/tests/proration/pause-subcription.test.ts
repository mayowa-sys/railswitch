import { vi, test, expect, beforeEach } from "vitest";
import * as ProrationHelper from "../../src/proration/proration-helper";
import { pauseSubscription } from "../../src/proration/pause-subcription";
import { SubscriptionsTable } from "../../src/schema/subscriptions.schema";
import { drizzle } from "drizzle-orm/node-postgres";

// Mock modules
vi.mock("../../src/db/client", () => ({
  db: drizzle.mock(),
}));

import { db } from "../../src/db/client";
import { QueryResult } from "pg";
import { DunningPolicy } from "../../src/state-machines/subscription.js";
import { GlobalLogger } from "../../src/utils/logger";
import { DrizzleSubscriptionRepository } from "../../src/db/drizzle-repository.js";

vi.mock("./ProrationHelper", () => ({
  ProrationHelper: {
    getSubscription: vi.fn(),
  },
}));

vi.mock("./logger", () => ({
  pauseLogger: {
    error: vi.fn(),
  },
}));
test("pauses an active subscription", async () => {
  const mockWrapper = {
    processEvent: vi.fn().mockResolvedValue(undefined),
  };

  const mockSubscription = {
    id: "sub_1234567890",
    merchant_id: "merchant_abc123",
    customer_id: "customer_xyz789",
    plan_id: "plan_pro_monthly",
    policy: {
      maxRetries: 3,
      ussdEnabled: true,
      graceHours: 72,
      baseDelayMinutes: 60,
      maxDelayHours: 72,
    } as DunningPolicy,
    state: "active" as const,
    version: 1,
    retry_count: 0,
    last_failure_reason: null,
    last_failure_retryable: null,
    va_id: "va_2024_001",
    va_expires_at: new Date("2025-12-31"),
    current_invoice_id: "invoice_20240115_001",
    cancel_at_period_end: false,
    metadata: {
      source: "web",
      campaign: "seasonal_promo",
    },
    created_at: new Date("2024-01-15T10:30:00Z"),
    updated_at: new Date("2024-01-15T10:30:00Z"),
    next_billing_at: new Date("2024-02-15T10:30:00Z"),
    trial_ends_at: null,
    current_period_start: new Date("2024-01-15T10:30:00Z"),
    current_period_end: new Date("2024-02-15T10:30:00Z"),
    paused_at: null,
    cancelled_at: null,
  } as typeof SubscriptionsTable.$inferSelect;

  // Mock database queries
  vi.mocked(db.execute).mockResolvedValue(
    {} as QueryResult<Record<string, never>>,
  );
  vi.mocked(db.update(SubscriptionsTable).set({}).where).mockResolvedValue(
    {} as QueryResult<never>,
  );

  // Mock getting subscription in active state
  vi.mocked(ProrationHelper.getSubscription).mockResolvedValue(mockSubscription);

  await pauseSubscription("sub_123", "merchant_456", mockWrapper);

  // Verify calls
  expect(db.execute).toHaveBeenCalled();
  expect(ProrationHelper.getSubscription).toHaveBeenCalledWith("sub_123");
  expect(mockWrapper.processEvent).toHaveBeenCalledWith({
    subscriptionId: "sub_123",
    event: { type: "PAUSE_REQUESTED", actor: "customer" },
    idempotencyKey: "idem",
  });
});
