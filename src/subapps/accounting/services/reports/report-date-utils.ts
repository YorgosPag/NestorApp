/**
 * @fileoverview Report Date Utilities (Phase 2c)
 * @description Resolves date presets to PeriodRange triplets for comparative reports
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q9 (Presets + Custom)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ReportDateFilter, ReportDatePreset, ResolvedPeriods } from '../../types/reports';

// ============================================================================
// PRESET RESOLUTION
// ============================================================================

/**
 * Resolve a date preset (or custom range) to three periods for comparative analysis.
 *
 * Returns: current, previousPeriod (MoM/QoQ), yearOverYear (same period last year).
 */
export function resolveReportPeriods(filter: ReportDateFilter): ResolvedPeriods {
  const current = resolvePresetToRange(filter);
  const previousPeriod = shiftPeriodBack(current, filter.preset);
  const yearOverYear = shiftYearBack(current);

  return { current, previousPeriod, yearOverYear };
}

/** Validate a ReportDateFilter, return error message or null */
export function validateDateFilter(filter: ReportDateFilter): string | null {
  if (!VALID_PRESETS.has(filter.preset)) {
    return `Invalid preset: ${filter.preset}. Valid: ${[...VALID_PRESETS].join(', ')}`;
  }
  if (filter.preset === 'custom') {
    if (!filter.customFrom || !filter.customTo) {
      return 'Custom preset requires both customFrom and customTo';
    }
    if (filter.customFrom > filter.customTo) {
      return 'customFrom must be before customTo';
    }
    const diffMs = new Date(filter.customTo).getTime() - new Date(filter.customFrom).getTime();
    const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
    if (diffMs > fiveYearsMs) {
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

function resolvePresetToRange(filter: ReportDateFilter): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  switch (filter.preset) {
    case 'this_month':
      return monthRange(year, month);
    case 'last_month':
      return month === 0
        ? monthRange(year - 1, 11)
        : monthRange(year, month - 1);
    case 'this_quarter':
      return quarterRange(year, Math.floor(month / 3));
    case 'last_quarter': {
      const q = Math.floor(month / 3);
      return q === 0
        ? quarterRange(year - 1, 3)
        : quarterRange(year, q - 1);
    }
    case 'this_year':
      return yearRange(year);
    case 'last_year':
      return yearRange(year - 1);
    case 'ytd':
      return { from: toISO(year, 0, 1), to: toISO(year, month, now.getDate()) };
    case 'custom':
      return { from: filter.customFrom!, to: filter.customTo! };
  }
}

/** Shift a period back by one sequential unit (month→prev month, quarter→prev quarter) */
function shiftPeriodBack(current: DateRange, preset: ReportDatePreset): DateRange {
  const fromDate = new Date(current.from);
  const toDate = new Date(current.to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const durationDays = Math.round(durationMs / (24 * 60 * 60 * 1000));

  if (isMonthPreset(preset) || durationDays <= 31) {
    return shiftMonths(fromDate, -1);
  }
  if (isQuarterPreset(preset) || (durationDays > 31 && durationDays <= 92)) {
    return shiftMonths(fromDate, -3);
  }
  // Year or custom > quarter: shift by same duration
  return shiftMonths(fromDate, -12);
}

/** Shift period back by exactly one year */
function shiftYearBack(current: DateRange): DateRange {
  const fromDate = new Date(current.from);
  const toDate = new Date(current.to);
  return {
    from: toISO(fromDate.getFullYear() - 1, fromDate.getMonth(), fromDate.getDate()),
    to: toISO(toDate.getFullYear() - 1, toDate.getMonth(), toDate.getDate()),
  };
}

function shiftMonths(fromDate: Date, months: number): DateRange {
  const newFrom = new Date(fromDate);
  newFrom.setMonth(newFrom.getMonth() + months);
  const newTo = new Date(newFrom);
  // End of that month
  newTo.setMonth(newTo.getMonth() + Math.abs(months));
  newTo.setDate(newTo.getDate() - 1);
  return {
    from: formatDateLocalISO(newFrom),
    to: formatDateLocalISO(newTo),
  };
}

function monthRange(year: number, month: number): DateRange {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: toISO(year, month, 1), to: toISO(year, month, lastDay) };
}

function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = quarter * 3;
  const endMonth = startMonth + 2;
  const lastDay = new Date(year, endMonth + 1, 0).getDate();
  return { from: toISO(year, startMonth, 1), to: toISO(year, endMonth, lastDay) };
}

function yearRange(year: number): DateRange {
  return { from: toISO(year, 0, 1), to: toISO(year, 11, 31) };
}

function toISO(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function formatDateLocalISO(date: Date): string {
  return toISO(date.getFullYear(), date.getMonth(), date.getDate());
}

function isMonthPreset(preset: ReportDatePreset): boolean {
  return preset === 'this_month' || preset === 'last_month';
}

function isQuarterPreset(preset: ReportDatePreset): boolean {
  return preset === 'this_quarter' || preset === 'last_quarter';
}
