/**
 * Core Intl API wrappers for date, number, currency, and list formatting.
 * All functions are locale-aware via getCurrentLocale().
 *
 * @module intl-formatting
 * @see intl-utils.ts (barrel re-export)
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getCurrentLocale } from './intl-utils';

const logger = createModuleLogger('intl-formatting');

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date according to current locale
 */
export const formatDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = getCurrentLocale();

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
};

/**
 * Format a date the way a PUBLIC-FACING surface should read it: month as a WORD.
 *
 * WHY THIS EXISTS AS ONE FUNCTION, not an options literal repeated at call sites
 * (ADR-827 section 9.16 e):
 *
 *   Two showcase screens printed a raw ISO instant on screen —
 *   "Published 2026-08-29T14:00:48.842Z". Nobody reads `T`, `Z` or milliseconds, and
 *   the `Z` is UTC, so the text stated a wall-clock time that is NOT the reader's.
 *   No gate catches this: the label itself comes from `t()`, so it is not a hardcoded
 *   string; it is not geometry; no i18n key is missing. Only opening the page found it.
 *
 *   The fix is a formatting DECISION — "public surfaces spell the month out" — and a
 *   decision belongs in exactly one place. Repeating
 *   `{ day: 'numeric', month: 'long', year: 'numeric' }` at each call site would make
 *   the decision editable in N places and therefore divergent (ADR-749).
 *
 * Renders in the VIEWER'S timezone, which is the point: the instant is stored in UTC
 * and read by a human somewhere else.
 *
 * DO NOT reduce this to `formatDate(date, { month: 'long' })` on the grounds that
 * `formatDate` already defaults `day` and `year`. Stating all three PINS the promise
 * here: caller options win the spread, so this public surface is immune to a change of
 * `formatDate`'s defaults made for the app's dense internal screens. Measured: removing
 * a field from ONE level alone leaves the output intact (the anchor's mutation run went
 * green); removing it from BOTH goes red. Belt-and-suspenders (N.7.2 #4), not redundancy.
 *
 * @see formatDate for the compact numeric form used inside the app's dense surfaces.
 */
export const formatLongDate = (date: Date | string | number): string =>
  formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Format date and time according to current locale
 *
 * ENTERPRISE: Handles both explicit style options (dateStyle/timeStyle)
 * and granular options (year/month/day/hour/minute)
 * Note: dateStyle/timeStyle cannot be combined with granular options
 */
export const formatDateTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
  if (!date) return '-';

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) return '-';

  const locale = getCurrentLocale();

  // ENTERPRISE: If dateStyle or timeStyle is provided, use ONLY those options
  // (they cannot be combined with granular options like hour/minute/year etc)
  const hasStyleOptions = options?.dateStyle || options?.timeStyle;

  const finalOptions: Intl.DateTimeFormatOptions = hasStyleOptions
    ? options  // Use only the style options
    : {
        // Default granular options
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      };

  try {
    return new Intl.DateTimeFormat(locale, finalOptions).format(dateObj);
  } catch (error) {
    logger.warn('formatDateTime error', { error });
    return '-';
  }
};

/**
 * Format relative time (e.g., "2 days ago")
 */
export const formatRelativeTime = (date: Date | string | number): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = getCurrentLocale();
  const now = new Date();
  const diffInMs = dateObj.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  // Use Math.trunc (not Math.floor) to avoid rounding -0.08 -> -1 (which shows "yesterday" for today's events)
  const diffInDays = Math.trunc(diffInMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffInDays) < 1) {
    const diffInHours = Math.trunc(diffInMs / (1000 * 60 * 60));
    if (Math.abs(diffInHours) < 1) {
      const diffInMinutes = Math.trunc(diffInMs / (1000 * 60));
      if (diffInMinutes === 0) return rtf.format(0, 'minute');
      return rtf.format(diffInMinutes, 'minute');
    }
    return rtf.format(diffInHours, 'hour');
  }

  if (Math.abs(diffInDays) < 7) {
    return rtf.format(diffInDays, 'day');
  }

  if (Math.abs(diffInDays) < 30) {
    const diffInWeeks = Math.trunc(diffInDays / 7);
    return rtf.format(diffInWeeks, 'week');
  }

  const diffInMonths = Math.trunc(diffInDays / 30);
  return rtf.format(diffInMonths, 'month');
};

// ============================================================================
// NUMBER / CURRENCY FORMATTING
// ============================================================================

/**
 * Format currency according to current locale
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'EUR',
  options?: Intl.NumberFormatOptions
): string => {
  const locale = getCurrentLocale();

  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  };

  return new Intl.NumberFormat(locale, { ...defaultOptions, ...options }).format(amount);
};

/**
 * Format number according to current locale
 */
export const formatNumber = (number: number, options?: Intl.NumberFormatOptions): string => {
  const locale = getCurrentLocale();
  return new Intl.NumberFormat(locale, options).format(number);
};

/**
 * Format percentage according to current locale
 */
export const formatPercentage = (value: number, options?: Intl.NumberFormatOptions): string => {
  const locale = getCurrentLocale();

  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  };

  return new Intl.NumberFormat(locale, { ...defaultOptions, ...options }).format(value / 100);
};

/**
 * Format price with unit (e.g., "EUR1,200/month")
 */
export const formatPriceWithUnit = (price: number, unit: string, currency: string = 'EUR'): string => {
  const formattedPrice = formatCurrency(price, currency);
  return `${formattedPrice}/${unit}`;
};

// ============================================================================
// LIST / COLLATION
// ============================================================================

/**
 * Join fragments into ONE locale-correct enumeration — "a, b and c" / «α, β και γ».
 *
 * WHY THIS EXISTS (ADR-834 section 6.4.b):
 *
 *   A screen that composes a sentence out of parts must not own the conjunction.
 *   `parts.join(', ')` yields «δικά σας, δημοσιευμένα» — no «και», wrong in every
 *   language; `parts.join(' and ')` hardcodes English into a Greek-first product,
 *   which rule N.11 forbids outright. `Intl.ListFormat` already knows the separator,
 *   the conjunction and the Oxford-comma policy of every locale we ship, so nobody
 *   has to write — or translate — a joining rule.
 *
 * WARNING: this is for enumerating COMPLETE, self-standing fragments that each agree
 * with one FIXED head noun. It is NOT a licence to build sentences by concatenation:
 * interpolating variable content into varying grammatical roles breaks word order,
 * gender and case (the well-documented i18n "word order problem"). Anything with a
 * variable subject belongs in ONE complete ICU template instead.
 *
 * @param parts   already-translated fragments, in the order they should read
 * @param type    'conjunction' = "a and b" (default) | 'disjunction' = "a or b"
 */
export const formatList = (
  parts: readonly string[],
  type: Intl.ListFormatType = 'conjunction'
): string => {
  const locale = getCurrentLocale();
  return new Intl.ListFormat(locale, { style: 'long', type }).format(parts);
};

/**
 * Compare strings according to current locale collation rules
 */
export const compareByLocale = (a: string, b: string): number => {
  const locale = getCurrentLocale();
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return collator.compare(a, b);
};

// ============================================================================
// DISPLAY NAMES / TEXT DIRECTION
// ============================================================================

/**
 * Get locale-specific display names
 */
export const getDisplayNames = () => {
  const locale = getCurrentLocale();

  return {
    language: new Intl.DisplayNames(locale, { type: 'language' }),
    region: new Intl.DisplayNames(locale, { type: 'region' }),
    currency: new Intl.DisplayNames(locale, { type: 'currency' })
  };
};


