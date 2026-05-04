/**
 * Date helpers for spend analytics: quarter ranges, period comparison, Athens TZ.
 * Pure functions — no side effects, fully testable.
 * @module lib/date/quarter-helpers
 * @see ADR-331 §4 D8, D11, D25
 */

// ============================================================================
// INTERNAL — ATHENS TZ
// ============================================================================

/** Day-of-month of the last Sunday in a given month (1-indexed month). */
function lastSundayOfMonth(year: number, month: number): number {
  // new Date(year, month, 0) = last day of `month` (JS month is 0-indexed)
  const last = new Date(year, month, 0);
  return last.getDate() - last.getDay(); // getDay: 0 = Sunday
}

// ============================================================================
// ATHENS TIMEZONE (Europe/Athens)
// ============================================================================

/** UTC offset of Europe/Athens in hours: 3 (EEST, summer) or 2 (EET, winter). */
export function athensOffsetHours(dateStr: string): number {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const day = parseInt(dateStr.slice(8, 10), 10);
  if (month >= 4 && month <= 9) return 3;
  if (month === 3) return day >= lastSundayOfMonth(year, 3) ? 3 : 2;
  if (month === 10) return day >= lastSundayOfMonth(year, 10) ? 2 : 3;
  return 2; // EET (Nov–Feb)
}

/**
 * Converts Athens local date strings (YYYY-MM-DD) to a UTC ISO datetime range.
 * - `from` → midnight Athens → UTC (may shift to previous calendar day).
 * - `to`   → end of day Athens (23:59:59.999) → UTC.
 */
export function athensDateRangeToUtc(from: string, to: string): { start: string; end: string } {
  const fromOff = athensOffsetHours(from);
  const toOff = athensOffsetHours(to);
  // Start: midnight Athens in UTC = dateStr at negative-offset UTC hours
  const startDate = new Date(`${from}T00:00:00.000Z`);
  startDate.setUTCHours(-fromOff); // wraps to previous day when offset > 0
  // End: 23:59:59.999 Athens = (23 - offset):59:59.999 UTC (same calendar date)
  const endHour = String(23 - toOff).padStart(2, '0');
  return {
    start: startDate.toISOString(),
    end: `${to}T${endHour}:59:59.999Z`,
  };
}

// ============================================================================
// QUARTER RANGE
// ============================================================================

/** Returns the first day of the current quarter and today as YYYY-MM-DD (UTC). */
export function getCurrentQuarterRange(now: Date): { from: string; to: string } {
  const year = now.getUTCFullYear();
  const quarter = Math.ceil((now.getUTCMonth() + 1) / 3);
  const fromMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
  return {
    from: `${year}-${fromMonth}-01`,
    to: now.toISOString().slice(0, 10),
  };
}

// ============================================================================
// PREVIOUS PERIOD
// ============================================================================

/**
 * Returns the equivalent previous period for comparison (D8=A always-on).
 * The duration equals the current range; the period ends 1 day before `from`.
 */
export function getPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${to}T00:00:00.000Z`).getTime();
  const prevToMs = fromMs - 86_400_000; // 1 day before `from`
  const prevFromMs = prevToMs - (toMs - fromMs);
  return {
    from: new Date(prevFromMs).toISOString().slice(0, 10),
    to: new Date(prevToMs).toISOString().slice(0, 10),
  };
}
