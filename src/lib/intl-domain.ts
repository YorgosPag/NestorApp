/**
 * Domain-specific formatting and backward-compatibility aliases.
 * Covers: floor labels, category/status labels, and legacy date/currency helpers.
 *
 * @module intl-domain
 * @see intl-utils.ts (barrel re-export)
 */

import { normalizeToDate } from '@/lib/date-local';
import { getCurrentLocale } from './intl-utils';
import { formatCurrency, formatDate, formatDateTime } from './intl-formatting';

// ============================================================================
// FLOOR FORMATTING
// ============================================================================

/**
 * Format floor label according to locale conventions (for numeric floors)
 */
export const formatFloorLabel = (floor: number): string => {
  const locale = getCurrentLocale();

  if (locale.startsWith('el')) {
    if (floor === 0) return 'Ισόγειο';
    if (floor === -1) return 'Υπόγειο';
    if (floor < -1) return `${Math.abs(floor)}ο Υπόγειο`;
    return `${floor}ος Όροφος`;
  }

  // English fallback
  if (floor === 0) return 'Ground Floor';
  if (floor === -1) return 'Basement';
  if (floor < -1) return `${Math.abs(floor)} Basement`;
  return `${floor} Floor`;
};

/**
 * Format floor string according to locale conventions
 * Handles string floor values from database (e.g., "-1", "Υπόγειο -1", "Ground Floor")
 *
 * @param floorValue - String floor value from database
 * @returns Localized floor label
 */
export const formatFloorString = (floorValue: string | number | undefined | null): string => {
  if (floorValue === undefined || floorValue === null || floorValue === '') {
    return '';
  }

  // If it's a number, use formatFloorLabel directly
  if (typeof floorValue === 'number') {
    return formatFloorLabel(floorValue);
  }

  const locale = getCurrentLocale();
  // 🏢 ENTERPRISE: Default to Greek if locale is not set (app default)
  const isGreek = !locale || locale.startsWith('el');
  const value = floorValue.toString().trim();

  // Try to parse as pure number (e.g., "-1", "0", "1")
  const numericMatch = value.match(/^-?\d+$/);
  if (numericMatch) {
    return formatFloorLabel(parseInt(value, 10));
  }

  // Handle already localized strings - normalize to current locale
  // Greek patterns - check first for exact matches
  if (value === 'Ισόγειο' || value.toLowerCase() === 'ground floor' || value.toLowerCase() === 'ground') {
    return isGreek ? 'Ισόγειο' : 'Ground Floor';
  }

  // Handle simple "Υπόγειο" without number
  if (value === 'Υπόγειο' || value.toLowerCase() === 'basement') {
    return isGreek ? 'Υπόγειο' : 'Basement';
  }

  // 🔧 FIX: Handle "Υπόγειο -1", "Υπόγειο -2", "Υπόγειο 1", "Υπόγειο 2" etc.
  // Using [\s\u00A0]* to match regular and non-breaking spaces
  const greekBasementMatch = value.match(/Υπόγειο[\s\u00A0]*(-?\d+)/i);
  if (greekBasementMatch) {
    const level = Math.abs(parseInt(greekBasementMatch[1], 10));
    if (level === 1) {
      return isGreek ? 'Υπόγειο' : 'Basement';
    }
    return isGreek ? `${level}ο Υπόγειο` : `Basement ${level}`;
  }

  // Handle "2ο Υπόγειο", "3ο Υπόγειο", etc.
  const greekOrdinalBasementMatch = value.match(/(\d+)ο?[\s\u00A0]*Υπόγειο/i);
  if (greekOrdinalBasementMatch) {
    const level = parseInt(greekOrdinalBasementMatch[1], 10);
    if (level === 1) {
      return isGreek ? 'Υπόγειο' : 'Basement';
    }
    return isGreek ? `${level}ο Υπόγειο` : `Basement ${level}`;
  }

  // Handle English basement patterns
  const englishBasementMatch = value.match(/basement[\s\u00A0]*(-?\d+)?/i);
  if (englishBasementMatch) {
    const level = englishBasementMatch[1] ? Math.abs(parseInt(englishBasementMatch[1], 10)) : 1;
    if (level === 1) {
      return isGreek ? 'Υπόγειο' : 'Basement';
    }
    return isGreek ? `${level}ο Υπόγειο` : `Basement ${level}`;
  }

  // Handle "Xος Όροφος" / "X Floor" patterns
  const greekFloorMatch = value.match(/(\d+)ος?[\s\u00A0]*[όο]ροφος/i);
  if (greekFloorMatch) {
    const floor = parseInt(greekFloorMatch[1], 10);
    return isGreek ? `${floor}ος Όροφος` : `Floor ${floor}`;
  }

  const englishFloorMatch = value.match(/floor[\s\u00A0]*(\d+)|(\d+)[\s\u00A0]*floor/i);
  if (englishFloorMatch) {
    const floor = parseInt(englishFloorMatch[1] || englishFloorMatch[2], 10);
    return isGreek ? `${floor}ος Όροφος` : `Floor ${floor}`;
  }

  // Fallback: return original value
  return value;
};

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
 * @param dateInput - Date, string, number, or undefined
 * @returns Greek formatted date with fallback
 *
 * @example formatDateGreek('2025-12-13') // "13/12/2025"
 */
export const formatDateGreek = (dateInput?: Date | string | number): string => {
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
 * @param value - Numeric amount (must be a valid number)
 * @returns Compact string like "€500K", "€1.2M", or "€800"
 */
export const formatCurrencyCompact = (value: number): string => {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
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
