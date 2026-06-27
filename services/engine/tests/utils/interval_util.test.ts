// services/engine/tests/utils/interval_util.test.ts

import { describe, it, expect } from "vitest";
import { getNextBillingDate } from "../../src/utils/interval_util";

describe("getNextBillingDate", () => {
  const ref = new Date("2026-06-15T10:00:00Z");

  describe("daily", () => {
    it("advances by interval_count days", () => {
      const result = getNextBillingDate(ref, "daily", 3);
      expect(result.toISOString()).toBe("2026-06-18T10:00:00.000Z");
    });

    it("handles month boundary", () => {
      const lateMonth = new Date("2026-01-31T10:00:00Z");
      const result = getNextBillingDate(lateMonth, "daily", 1);
      expect(result.toISOString()).toBe("2026-02-01T10:00:00.000Z");
    });
  });

  describe("weekly", () => {
    it("advances by interval_count weeks", () => {
      const result = getNextBillingDate(ref, "weekly", 2);
      const expected = new Date(ref.getTime() + 14 * 86_400_000);
      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });

  describe("monthly", () => {
    it("advances by interval_count months", () => {
      const result = getNextBillingDate(ref, "monthly", 1);
      expect(result.toISOString()).toBe("2026-07-15T10:00:00.000Z");
    });

    it("Jan 31 → Feb 28 (clamped)", () => {
      const jan31 = new Date("2026-01-31T10:00:00Z");
      const result = getNextBillingDate(jan31, "monthly", 1);
      expect(result.getDate()).toBe(28);
      expect(result.getMonth()).toBe(1); // February
    });

    it("Feb 29 → Mar 29", () => {
      const feb29 = new Date("2028-02-29T10:00:00Z"); // leap year
      const result = getNextBillingDate(feb29, "monthly", 1);
      expect(result.toISOString()).toBe("2028-03-29T10:00:00.000Z");
    });

    it("multiple months", () => {
      const result = getNextBillingDate(ref, "monthly", 3);
      expect(result.toISOString()).toBe("2026-09-15T10:00:00.000Z");
    });
  });

  describe("annual", () => {
    it("advances by interval_count years", () => {
      const result = getNextBillingDate(ref, "annual", 1);
      expect(result.toISOString()).toBe("2027-06-15T10:00:00.000Z");
    });

    it("Feb 29 leap year → Feb 28 next year", () => {
      const feb29 = new Date("2028-02-29T10:00:00Z");
      const result = getNextBillingDate(feb29, "annual", 1);
      expect(result.getUTCDate()).toBe(28);
      expect(result.getUTCMonth()).toBe(1);
    });
  });

  describe("day_of_month:N", () => {
    it("advances to Nth of next month if day has passed", () => {
      const jun15 = new Date("2026-06-15T10:00:00Z");
      const result = getNextBillingDate(jun15, "day_of_month:1", 1);
      expect(result.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    });

    it("keeps current month if day not yet reached", () => {
      const jun1 = new Date("2026-06-01T10:00:00Z");
      const result = getNextBillingDate(jun1, "day_of_month:15", 1);
      expect(result.toISOString()).toBe("2026-06-15T10:00:00.000Z");
    });

    it("clamps to month end when target day exceeds next month's days", () => {
      const jan31 = new Date("2026-01-31T10:00:00Z");
      const result = getNextBillingDate(jan31, "day_of_month:31", 1);
      expect(result.getDate()).toBe(28); // Feb only has 28
      expect(result.getMonth()).toBe(1);
    });
  });

  describe("day_of_week:N", () => {
    it("finds next matching day", () => {
      const monday = new Date("2026-06-15T00:00:00Z"); // Monday
      const result = getNextBillingDate(monday, "day_of_week:wed", 1);
      expect(result.getUTCDay()).toBe(3); // Wednesday
      expect(result.toISOString()).toBe("2026-06-17T00:00:00.000Z");
    });

    it("wraps to next week if today matches the day", () => {
      const monday = new Date("2026-06-15T00:00:00Z"); // Monday
      const result = getNextBillingDate(monday, "day_of_week:mon", 1);
      expect(result.getUTCDay()).toBe(1);
      expect(result.toISOString()).toBe("2026-06-22T00:00:00.000Z");
    });

    it("throws on unknown day", () => {
      expect(() => getNextBillingDate(ref, "day_of_week:xyz", 1)).toThrow(
        "Unknown day of week",
      );
    });
  });

  describe("unknown interval", () => {
    it("defaults to monthly", () => {
      const result = getNextBillingDate(ref, "unknown", 1);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(15);
    });
  });
});
