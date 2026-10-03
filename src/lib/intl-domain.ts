/**
 * Domain-specific formatting and backward-compatibility aliases.
 * Covers: category/status labels, and legacy date/currency helpers (floor labels → ADR-903).
 *
 * @module intl-domain
 * @see intl-utils.ts (barrel re-export)
 */

import { normalizeToDate } from '@/lib/date-local';
import { getCurrentLocale } from './intl-utils';
import { formatCurrency, formatDate, formatDateTime } from './intl-formatting';

// ============================================================================
// FLOOR FORMATTING — REMOVED (ADR-903)
// ============================================================================
// `formatFloorLabel` / `formatFloorString` ήταν ελληνικά γραμμένα στον κώδικα (N.11), αγνοούσαν το
// είδος στάθμης και έβγαζαν «1 Floor». Ο ΕΝΑΣ μορφοποιητής: `@/lib/floor/floor-label` (UI μέσω
// `useFloorLabel`, server μέσω `@/lib/floor/floor-label-bundle`)· ο ΕΝΑΣ parser: `@/lib/floor/floor-ref`.

// ============================================================================
// CATEGORY / STATUS LABELS
// ============================================================================

// 🏢 ENTERPRISE: getStatusLabel REMOVED 2026-04-18 (ADR-314 Phase B)
// Canonical SSoT: '@/lib/status-helpers' → getStatusLabel(domain, status, { t })
// Was hardcoding Greek/English in violation of i18n SSoT (SOS N.11).

// ============================================================================
// 🔄 CENTRALIZED DATE FORMATTING - BACKWARD COMPATIBILITY ALIASES
// ============================================================================

/**
 * 🎯 ENTERPRISE DATE FORMATTING CENTRALIZATION (2025-12-13)
 *
 * Unified date formatting system - Single Source of Truth για όλες τις date operations.
 * Αντικαθιστά τις διπλότυπες functions από project-utils.ts, obligations-utils.ts, validation.ts
 *
 * ✅ BENEFITS:
 * - Zero code duplication
 * - Consistent date formatting across app
 * - Locale-aware formatting
 * - Enterprise-grade type safety
 *
 * 📍 MIGRATION GUIDE:
 * - project-utils.ts formatDate → Use formatDateShort
 * - obligations-utils.ts formatDate → Use formatDateLong
 * - validation.ts formatDateForDisplay → Use formatDateForDisplay
 * - All other date formatting → Use main formatDate with options
 */

/**
 * Format date in short format (dd/MM/yyyy) - Replaces project-utils.ts formatDate
 *
 * @param dateInput - Date, string, number, or undefined
 * @returns Short formatted date or fallback
 *
 * @example formatDateShort('2025-12-13') // "13/12/2025"
 * @example formatDateShort(undefined) // "-"
 */
export const formatDateShort = (dateInput?: Date | string | number): string => {
  if (!dateInput) return '-';

  try {
    return formatDate(dateInput, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

/**
 * Format date for display in forms/validation - Replaces validation.ts formatDateForDisplay
 *
 * @param dateStr - Date string (optional)
 * @returns Display formatted date or empty string
 *
 * @example formatDateForDisplay('2025-12-13') // "13/12/2025"
 * @example formatDateForDisplay(undefined) // ""
 */
export const formatDateForDisplay = (dateStr?: string): string => {
  if (!dateStr) return '';

  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return '';

    return formatDate(dateObj);
  } catch {
    return '';
  }
};

/**
 * Format date in Greek short format with validation - Enhanced version
 *
 * Alias of {@link formatDateShort}: the locale already drives the dd/MM/yyyy order,
 * so "Greek short" and "short" are the same formatting decision — keeping two bodies
 * meant one could drift from the other silently.
 *
 * @param dateInput - Date, string, number, or undefined
 * @returns Greek formatted date with fallback
 *
 * @example formatDateGreek('2025-12-13') // "13/12/2025"
 */
export const formatDateGreek = formatDateShort;

/**
 * Format currency with zero decimals and null guard
 * Replaces 7+ local formatCurrency duplicates across sales components
 *
 * @param amount - Nullable amount
 * @returns Formatted string like "€12.500" or "—" for null/undefined
 */
export const formatCurrencyWhole = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '—';
  return formatCurrency(amount, 'EUR', { maximumFractionDigits: 0 });
};

/**
 * Format currency in compact notation (€500K / €1.2M)
 * Replaces 2 local formatCurrencyCompact duplicates in sales pages
 *
 * The magnitude decides the unit, so a negative amount abbreviates exactly like its
 * positive twin and keeps its sign: an axis that runs through zero — a depleting
 * interest reserve, a cash-flow gap — reads "-€50K", not "€-50000". Comparing the
 * signed value against the thresholds silently left every negative amount unabbreviated.
 *
 * @param value - Numeric amount (must be a valid number)
 * @returns Compact string like "€500K", "-€1.2M", or "€800"
 */
export const formatCurrencyCompact = (value: number): string => {
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${sign}€${(magnitude / 1_000_000).toFixed(1)}M`;
  if (magnitude >= 1_000) return `${sign}€${(magnitude / 1_000).toFixed(0)}K`;
  return `${sign}€${magnitude}`;
};

/**
 * ✅ CENTRALIZED: Calculate days until completion date
 * Consolidates duplicate functions from BuildingCardUtils.ts and project-utils.ts
 */
export const getDaysUntilCompletion = (completionDate?: string): number | null => {
  if (!completionDate) return null;
  const today = new Date();
  const completion = new Date(completionDate);
  const diffTime = completion.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// ============================================================================
// 🔄 BRIDGE FUNCTIONS: FlexibleDateInput → Intl Formatting (ADR-208)
// ============================================================================

/**
 * Format any flexible date input (Firestore Timestamps, strings, Dates, etc.)
 * into a localized date+time string.
 *
 * Bridge: normalizeToDate() → formatDateTime()
 *
 * @param value - FlexibleDateInput (Date, string, number, Firestore Timestamp, null, undefined)
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string or '-' for invalid/missing input
 */
export const formatFlexibleDateTime = (value: unknown, options?: Intl.DateTimeFormatOptions): string => {
  const date = normalizeToDate(value);
  if (!date) return '-';
  return formatDateTime(date, options);
};

/**
 * Format any flexible date input into time-only (HH:mm).
 * Used by TelegramNotifications and similar real-time feeds.
 *
 * Bridge: normalizeToDate() → Intl time-only formatting
 *
 * @param value - FlexibleDateInput
 * @returns "HH:mm" string or '' for invalid/missing input
 */
/**
 * Format any flexible date input into a localized date-only string.
 * Bridge: normalizeToDate() → formatDate()
 * Replaces inline `typeof ts === 'object' && 'toDate' in ts ? ...` ternaries in JSX.
 * @see ADR-218 Phase 2
 */
export const formatFlexibleDate = (value: unknown, options?: Intl.DateTimeFormatOptions): string => {
  const date = normalizeToDate(value);
  if (!date) return '-';
  return formatDate(date, options);
};

export const formatFlexibleTimeOnly = (value: unknown): string => {
  const date = normalizeToDate(value);
  if (!date) return '';
  const locale = getCurrentLocale();
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
};
