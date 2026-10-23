/**
 * @module config/report-builder/report-computed-days
 *
 * SSoT for the day arithmetic of report-builder computed fields («πόσες ημέρες από …»).
 * Every `domain-defs-*` file wrote its own `Math.max(0, Math.round((Date.now() - new Date(x).getTime()) / 86_400_000))`
 * — the clone family CHECK 3.28 flagged (N.0.2, 2026-10-23).
 *
 * 🔑 Reading the instant is NOT owned here: it is `daysSinceOrNull` (ADR-218), which also reads Firestore Timestamps
 *    and answers `null` for an unreadable value (the hand-written copies answered `NaN`). This module owns only the
 *    rounding POLICY a report column shows: nearest day (default) or completed days (`'floor'`).
 *
 * @see ADR-268 (report builder) · ADR-218 §Phase 4 (`daysSinceOrNull`)
 */

import { daysSinceOrNull } from '@/lib/date-local';

type ReportDoc = Record<string, unknown>;

/** `'round'` = nearest whole day · `'floor'` = completed days. */
export type DayRounding = 'round' | 'floor';

/** The first present value among `fields` — a fallback chain such as `transactionDate` → `valueDate`. */
function firstPresent(doc: ReportDoc, fields: string | readonly string[]): unknown {
  for (const field of typeof fields === 'string' ? [fields] : fields) {
    const value = doc[field];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/** Signed whole days since the doc's date (positive = past · negative = future); `null` when absent or unreadable. */
export function docDaysPast(
  doc: ReportDoc,
  fields: string | readonly string[],
  rounding: DayRounding = 'round',
): number | null {
  const days = daysSinceOrNull(firstPresent(doc, fields));
  return days === null ? null : Math[rounding](days);
}

/** The doc's AGE in whole days — like {@link docDaysPast}, but a future date counts as 0 (never negative). */
export function docAgeDays(
  doc: ReportDoc,
  fields: string | readonly string[],
  rounding: DayRounding = 'round',
): number | null {
  const days = docDaysPast(doc, fields, rounding);
  return days === null ? null : Math.max(0, days);
}
