/**
 * @fileoverview Report Date Utilities (Phase 2c)
 * @description Resolves date presets to PeriodRange triplets for comparative reports
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q9 (Presets + Custom)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * 📅 **Όλη η αριθμητική σε κλειδιά ημέρας `YYYY-MM-DD`, ποτέ σε `Date`** (2026-10-29, ADR-919 κατάλοιπα 📅′):
 * - «Τώρα» = η λογιστική ημέρα **Αθήνας** (`accountingToday`), όχι το `new Date()` του διακομιστή (UTC): στον Netcup
 *   ο «τρέχων μήνας» άλλαζε στις 02:00/03:00 ώρα Ελλάδας, και η 1η του μήνα μετρούσε στον προηγούμενο.
 * - Μετατοπίσεις μηνών/ετών **ψαλιδισμένες** (`addMonthsToDateKey`, ADR-828 §1): η σύγκριση έτους με το 29/2/2028
 *   δίνει 28/2/2027 — το παλιό `toISO(y − 1, …)` έγραφε την ανύπαρκτη 29/2/2027.
 * - Καμία ανάγνωση `new Date('YYYY-MM-DD')` με τοπικά getters (μεσάνυχτα UTC ⇒ «χθες» δυτικά του Greenwich).
 */

import type { ReportDateFilter, ReportDatePreset, ResolvedPeriods } from '../../types/reports';
import { daysInMonth } from '@/lib/date/calendar-arithmetic';
import { isCalendarDay, isoCalendarDay, parseCalendarDay } from '@/lib/date/calendar-day';
import { addDaysToDateKey, addMonthsToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { accountingToday } from '../../utils/accounting-day';

// ============================================================================
// PRESET RESOLUTION
// ============================================================================

/**
 * Resolve a date preset (or custom range) to three periods for comparative analysis.
 *
 * Returns: current, previousPeriod (MoM/QoQ), yearOverYear (same period last year).
 * `now` εγχέεται για τα tests· προεπιλογή η τρέχουσα στιγμή.
 */
export function resolveReportPeriods(filter: ReportDateFilter, now: Date = new Date()): ResolvedPeriods {
  const current = resolvePresetToRange(filter, now);
  const previousPeriod = shiftPeriodBack(current, filter.preset);
  const yearOverYear = shiftYearBack(current);

  return { current, previousPeriod, yearOverYear };
}

/** Μέγιστο εύρος προσαρμοσμένης περιόδου, σε **ημερολογιακούς** μήνες (5 έτη). */
const MAX_CUSTOM_RANGE_MONTHS = 60;

/** Validate a ReportDateFilter, return error message or null */
export function validateDateFilter(filter: ReportDateFilter): string | null {
  if (!VALID_PRESETS.has(filter.preset)) {
    return `Invalid preset: ${filter.preset}. Valid: ${[...VALID_PRESETS].join(', ')}`;
  }
  if (filter.preset === 'custom') {
    if (!filter.customFrom || !filter.customTo) {
      return 'Custom preset requires both customFrom and customTo';
    }
    // Υπαρκτές ημέρες `YYYY-MM-DD` — το `2026-02-30` δεν είναι όριο περιόδου (ADR-919).
    if (!isCalendarDay(filter.customFrom) || !isCalendarDay(filter.customTo)) {
      return 'customFrom and customTo must be existing calendar days (YYYY-MM-DD)';
    }
    if (filter.customFrom > filter.customTo) {
      return 'customFrom must be before customTo';
    }
    const latestTo = addMonthsToDateKey(filter.customFrom, MAX_CUSTOM_RANGE_MONTHS);
    if (latestTo !== null && filter.customTo > latestTo) {
      return 'Date range cannot exceed 5 years';
    }
  }
  return null;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const VALID_PRESETS = new Set<ReportDatePreset>([
  'this_month', 'last_month', 'this_quarter', 'last_quarter',
  'this_year', 'last_year', 'ytd', 'custom',
]);

interface DateRange {
  from: string;
  to: string;
}

function resolvePresetToRange(filter: ReportDateFilter, now: Date): DateRange {
  const today = accountingToday(now);
  // Το `accountingToday` δίνει πάντα υπαρκτή ημέρα.
  const { year, month } = parseCalendarDay(today) as { year: number; month: number };
  const quarter = Math.ceil(month / 3); // 1–4

  switch (filter.preset) {
    case 'this_month':
      return monthRange(year, month);
    case 'last_month':
      return month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1);
    case 'this_quarter':
      return quarterRange(year, quarter);
    case 'last_quarter':
      return quarter === 1 ? quarterRange(year - 1, 4) : quarterRange(year, quarter - 1);
    case 'this_year':
      return yearRange(year);
    case 'last_year':
      return yearRange(year - 1);
    case 'ytd':
      return { from: isoCalendarDay(year, 1, 1), to: today };
    case 'custom':
      return { from: filter.customFrom!, to: filter.customTo! };
  }
}

/** Shift a period back by one sequential unit (month→prev month, quarter→prev quarter) */
function shiftPeriodBack(current: DateRange, preset: ReportDatePreset): DateRange {
  const durationDays = daysBetweenDateKeys(current.from, current.to) ?? 0;

  if (isMonthPreset(preset) || durationDays <= 31) {
    return shiftMonths(current.from, -1);
  }
  if (isQuarterPreset(preset) || (durationDays > 31 && durationDays <= 92)) {
    return shiftMonths(current.from, -3);
  }
  // Year or custom > quarter: shift by same duration
  return shiftMonths(current.from, -12);
}

/** Shift period back by exactly one year — ψαλιδισμένο (29/2 ⇒ 28/2), ποτέ ανύπαρκτη ημέρα. */
function shiftYearBack(current: DateRange): DateRange {
  return {
    from: addMonthsToDateKey(current.from, -12) ?? current.from,
    to: addMonthsToDateKey(current.to, -12) ?? current.to,
  };
}

/** Η περίοδος `|months|` μηνών που ξεκινά `months` μήνες από το `from` (ως την παραμονή του επόμενου ορίου). */
function shiftMonths(from: string, months: number): DateRange {
  const newFrom = addMonthsToDateKey(from, months) ?? from;
  const nextStart = addMonthsToDateKey(newFrom, Math.abs(months)) ?? newFrom;
  return { from: newFrom, to: addDaysToDateKey(nextStart, -1) ?? newFrom };
}

/** Μήνας **1-based**. */
function monthRange(year: number, month: number): DateRange {
  return { from: isoCalendarDay(year, month, 1), to: isoCalendarDay(year, month, daysInMonth(year, month)) };
}

/** Τρίμηνο **1–4**. */
function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return { from: isoCalendarDay(year, startMonth, 1), to: isoCalendarDay(year, endMonth, daysInMonth(year, endMonth)) };
}

function yearRange(year: number): DateRange {
  return { from: isoCalendarDay(year, 1, 1), to: isoCalendarDay(year, 12, 31) };
}

function isMonthPreset(preset: ReportDatePreset): boolean {
  return preset === 'this_month' || preset === 'last_month';
}

function isQuarterPreset(preset: ReportDatePreset): boolean {
  return preset === 'this_quarter' || preset === 'last_quarter';
}
