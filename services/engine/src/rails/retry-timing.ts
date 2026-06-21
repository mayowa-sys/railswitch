// services/engine/src/rails/retry-timing.ts
//
// Smart retry timing for failed card charges. Pure function — no IO,
// no scheduling, no Nomba calls. Returns when the next retry should fire.
//
// HEURISTICS (in priority order)
// ------------------------------
// 1. Exponential backoff with jitter, capped at policy.maxDelayHours.
// 2. If the candidate time falls within ±7 days BEFORE a payday window
//    (25th–30th of any month), snap forward to the next payday day at
//    11:00 WAT. Customers reliably have funds in this window.
// 3. Else, if the candidate time falls outside the 10:00–14:00 WAT
//    Nigerian liquidity window, push to the next day at 11:00 WAT.
//
// WAT = UTC+1, no DST. We do timezone math in UTC offsets, not by
// constructing Date objects in local time (which depends on the host).

import type { DunningPolicy } from '../state-machines/subscription.js';

export interface NextRetryInput {
  currentTime: Date;
  /** 0-indexed: 0 means "this is the first retry after the original failure". */
  retryCount: number;
  policy: DunningPolicy;
  /** Test seam for jitter. Defaults to Math.random. */
  rng?: () => number;
}

const WAT_OFFSET_MS = 60 * 60 * 1000;       // UTC+1
const LIQUIDITY_START_HOUR_WAT = 10;
const LIQUIDITY_END_HOUR_WAT = 14;          // exclusive upper bound
const RETRY_TIME_HOUR_WAT = 11;             // the time-of-day we snap to
const PAYDAY_START_DOM = 25;
const PAYDAY_END_DOM = 30;
const PAYDAY_LOOKAHEAD_DAYS = 7;

/**
 * Computes the next retry timestamp from the inputs. Pure.
 */
export function nextRetryAt(input: NextRetryInput): Date {
  const { currentTime, retryCount, policy } = input;
  const rng = input.rng ?? Math.random;

  // ---- 1. Exponential backoff with jitter ----
  const baseMinutes = policy.baseDelayMinutes;
  const exponential = baseMinutes * Math.pow(2, retryCount);
  const jitterFactor = 0.85 + rng() * 0.30;            // ±15% (range 0.85..1.15)
  const jittered = exponential * jitterFactor;
  const cappedMinutes = Math.min(jittered, policy.maxDelayHours * 60);
  const delayMs = cappedMinutes * 60 * 1000;
  let candidate = new Date(currentTime.getTime() + delayMs);

  // ---- 2. Payday snap ----
  const upcomingPayday = nextPaydaySlotAfter(candidate, PAYDAY_LOOKAHEAD_DAYS);
  if (upcomingPayday) {
    return upcomingPayday;
  }

  // ---- 3. Liquidity window snap ----
  if (!inLiquidityWindowWAT(candidate)) {
    candidate = nextWATSlot(candidate, RETRY_TIME_HOUR_WAT);
  }

  return candidate;
}

/**
 * If `from` is within the lookahead window before a payday (25th–30th of
 * the next or current month), returns that payday at 11:00 WAT. Otherwise null.
 *
 * "Within lookahead before payday" means: if today's WAT date is between
 * (payday_start - lookahead) and payday_end inclusive, we snap to the payday.
 * If we're past payday_end, we look at next month's payday.
 */
function nextPaydaySlotAfter(from: Date, lookaheadDays: number): Date | null {
  const wat = toWAT(from);
  const dom = wat.getUTCDate();
  const year = wat.getUTCFullYear();
  const month = wat.getUTCMonth();

  // Are we currently inside the payday window itself? Snap to today at 11 WAT.
  if (dom >= PAYDAY_START_DOM && dom <= PAYDAY_END_DOM) {
    return atWATHour(year, month, dom, RETRY_TIME_HOUR_WAT);
  }

  // Are we within `lookaheadDays` BEFORE this month's payday window opens?
  // Snap to payday_start.
  const daysUntilPaydayStart = PAYDAY_START_DOM - dom;
  if (daysUntilPaydayStart > 0 && daysUntilPaydayStart <= lookaheadDays) {
    return atWATHour(year, month, PAYDAY_START_DOM, RETRY_TIME_HOUR_WAT);
  }

  // Otherwise we're past payday_end (or far before payday_start). No snap.
  return null;
}

/** True if `d`'s wall-clock WAT hour is in [10, 14). */
function inLiquidityWindowWAT(d: Date): boolean {
  const wat = toWAT(d);
  const hour = wat.getUTCHours();
  return hour >= LIQUIDITY_START_HOUR_WAT && hour < LIQUIDITY_END_HOUR_WAT;
}

/**
 * Returns the next instant at `hourWAT` strictly after `from`. If `from`'s
 * WAT hour is already past `hourWAT`, this is tomorrow at `hourWAT` WAT.
 * Otherwise it's today at `hourWAT` WAT.
 */
function nextWATSlot(from: Date, hourWAT: number): Date {
  const wat = toWAT(from);
  const candidate = atWATHour(
    wat.getUTCFullYear(),
    wat.getUTCMonth(),
    wat.getUTCDate(),
    hourWAT,
  );
  if (candidate.getTime() > from.getTime()) {
    return candidate;
  }
  // push to next day
  return atWATHour(
    wat.getUTCFullYear(),
    wat.getUTCMonth(),
    wat.getUTCDate() + 1,
    hourWAT,
  );
}

/** Constructs the UTC instant corresponding to (Y/M/D, hourWAT:00) in WAT. */
function atWATHour(year: number, monthZeroIndexed: number, day: number, hourWAT: number): Date {
  // WAT = UTC+1, so an event at hourWAT in WAT is at (hourWAT - 1) in UTC,
  // on the same calendar day in WAT. Easiest: build the UTC ms directly.
  const utcMs = Date.UTC(year, monthZeroIndexed, day, hourWAT, 0, 0, 0) - WAT_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Returns a Date whose UTC fields mirror `d`'s WAT wall-clock fields.
 * This is a TRICK — the returned Date is not the same instant as `d`;
 * we use it only to read its `getUTC*` accessors as if they were WAT fields.
 * Never persist or send this Date to anything.
 */
function toWAT(d: Date): Date {
  return new Date(d.getTime() + WAT_OFFSET_MS);
}
