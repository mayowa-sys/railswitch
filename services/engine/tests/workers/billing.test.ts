// services/engine/tests/workers/billing.test.ts

import { describe, it, expect } from "vitest";
import { getNextBillingDate } from "../../src/utils/interval_util";

// Unit tests for pure functions used by the billing worker.
// DB-integrated tests (worker processCharge, trial conversion) require
// a running Postgres + Redis and live in the integration test suite.

describe("Billing — interval calculations", () => {
  it("monthly cycle from Feb 29 (leap year) → Mar 29", () => {
    const feb29 = new Date("2028-02-29T00:00:00Z");
    const next = getNextBillingDate(feb29, "monthly", 1);
    expect(next.getUTCMonth()).toBe(2); // March
    expect(next.getUTCDate()).toBe(29);
  });

  it("Jan 31 → Feb 28 (end-of-month clamp)", () => {
    const jan31 = new Date("2026-01-31T00:00:00Z");
    const next = getNextBillingDate(jan31, "monthly", 1);
    expect(next.getUTCMonth()).toBe(1); // Feb
    expect(next.getUTCDate()).toBe(28);
  });

  it("annual cycle preserves day of month", () => {
    const ref = new Date("2026-03-15T00:00:00Z");
    const next = getNextBillingDate(ref, "annual", 1);
    expect(next.getUTCFullYear()).toBe(2027);
    expect(next.getUTCMonth()).toBe(2); // March
    expect(next.getUTCDate()).toBe(15);
  });

  it("daily cycle crosses month boundary correctly", () => {
    const feb28 = new Date("2026-02-28T00:00:00Z");
    const next = getNextBillingDate(feb28, "daily", 1);
    expect(next.getUTCMonth()).toBe(2); // March
    expect(next.getUTCDate()).toBe(1);
  });

  it("weekly cycle handles year boundary", () => {
    const dec28 = new Date("2026-12-28T00:00:00Z");
    const next = getNextBillingDate(dec28, "weekly", 1);
    expect(next.getUTCFullYear()).toBe(2027);
  });

  it("day_of_month:15 advances correctly when day has passed", () => {
    const jun20 = new Date("2026-06-20T00:00:00Z");
    const next = getNextBillingDate(jun20, "day_of_month:15", 1);
    expect(next.getUTCMonth()).toBe(6); // July
    expect(next.getUTCDate()).toBe(15);
  });

  it("day_of_week:fri finds next Friday from Wednesday", () => {
    const wed = new Date("2026-06-17T00:00:00Z"); // Wednesday
    const next = getNextBillingDate(wed, "day_of_week:fri", 1);
    expect(next.getUTCDay()).toBe(5); // Friday
    expect(next.getUTCDate()).toBe(19);
  });
});
