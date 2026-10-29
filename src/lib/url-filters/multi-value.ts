/**
 * URL multi-value filter SSoT — comma-separated array (de)serialization.
 *
 * Pure helpers for query-string filter params shaped like
 * `?categoryCode=TSIMENTO,SIDIROURGIKA&supplierId=sup_titan,sup_aget`.
 *
 * Empty arrays serialize to `undefined` so callers can omit the param entirely
 * (= "All"); the parser treats missing/blank entries as empty.
 *
 * @module lib/url-filters/multi-value
 * @see ADR-331 §4 D7, D12 — URL state SSoT + multi-select filters
 */

import { isCalendarDay } from '@/lib/date/calendar-day';

/** Parses a comma-separated query param into a trimmed string array. */
export function parseFilterArray(param: string | null | undefined): string[] {
  if (!param) return [];
  return param.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Serializes a string array to a comma-separated query param value.
 * Returns `undefined` for empty input so callers can omit the param.
 */
export function serializeFilterArray(values: readonly string[] | null | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  const cleaned = values.map(v => v.trim()).filter(Boolean);
  return cleaned.length === 0 ? undefined : cleaned.join(',');
}

/**
 * Returns `param` if it is an existing calendar day `YYYY-MM-DD`, else `fallback`.
 * `2027-02-30` falls back — the project's one judge (`isCalendarDay`, ADR-919).
 */
export function parseDateOrDefault(param: string | null | undefined, fallback: string): string {
  return isCalendarDay(param) ? param : fallback;
}
