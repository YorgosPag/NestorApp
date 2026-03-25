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
 * Get list format according to current locale
 */
export const formatList = (items: string[], options?: Intl.ListFormatOptions): string => {
  const locale = getCurrentLocale();

  const defaultOptions: Intl.ListFormatOptions = {
    style: 'long',
    type: 'conjunction'
  };

  return new Intl.ListFormat(locale, { ...defaultOptions, ...options }).format(items);
};

/**
 * Sort strings according to current locale collation rules
 */
export const sortByLocale = (strings: string[]): string[] => {
  const locale = getCurrentLocale();
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return [...strings].sort(collator.compare);
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

/**
 * Check if current locale uses RTL writing direction
 */
export const isRTLLocale = (): boolean => {
  const locale = getCurrentLocale();
  const rtlLocales = ['ar', 'he', 'fa', 'ur'];
  return rtlLocales.some(rtl => locale.startsWith(rtl));
};

/**
 * Get text direction for current locale
 */
export const getTextDirection = (): 'ltr' | 'rtl' => {
  return isRTLLocale() ? 'rtl' : 'ltr';
};
