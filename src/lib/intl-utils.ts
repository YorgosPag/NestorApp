/**
 * Internationalization utilities using native Intl APIs
 * Provides consistent formatting across the application
 */

import i18n from '@/i18n/config';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('intl-utils');

/**
 * Get current locale from i18n instance
 */
export const getCurrentLocale = (): string => {
  return i18n.language || 'el';
};

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
 * 🏢 ENTERPRISE: Handles both explicit style options (dateStyle/timeStyle)
 * and granular options (year/month/day/hour/minute)
 * Note: dateStyle/timeStyle cannot be combined with granular options
 */
export const formatDateTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
  if (!date) return '-';

  const dateObj = date instanceof Date ? date : new Date(date);

  // Έλεγχος αν η ημερομηνία είναι έγκυρη
  if (isNaN(dateObj.getTime())) return '-';

  const locale = getCurrentLocale();

  // 🔒 ENTERPRISE: If dateStyle or timeStyle is provided, use ONLY those options
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
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  if (Math.abs(diffInDays) < 1) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (Math.abs(diffInHours) < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return rtf.format(diffInMinutes, 'minute');
    }
    return rtf.format(diffInHours, 'hour');
  }
  
  if (Math.abs(diffInDays) < 7) {
    return rtf.format(diffInDays, 'day');
  }
  
  if (Math.abs(diffInDays) < 30) {
    const diffInWeeks = Math.floor(diffInDays / 7);
    return rtf.format(diffInWeeks, 'week');
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return rtf.format(diffInMonths, 'month');
};

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
 * Format price with unit (e.g., "€1,200/month")
 */
export const formatPriceWithUnit = (price: number, unit: string, currency: string = 'EUR'): string => {
  const formattedPrice = formatCurrency(price, currency);
  return `${formattedPrice}/${unit}`;
};

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

/**
 * Get category label according to locale
 */
export const getCategoryLabel = (category: string): string => {
  const locale = getCurrentLocale();
  
  if (locale.startsWith('el')) {
    switch (category) {
      case 'residential': return 'Κατοικία';
      case 'commercial': return 'Εμπορικό';
      case 'mixed': return 'Μικτό';
      case 'industrial': return 'Βιομηχανικό';
      default: return category;
    }
  }
  
  // English fallback
  switch (category) {
    case 'residential': return 'Residential';
    case 'commercial': return 'Commercial';
    case 'mixed': return 'Mixed';
    case 'industrial': return 'Industrial';
    default: return category;
  }
};

/**
 * Get status label according to locale
 */
export const getStatusLabel = (status: string): string => {
  const locale = getCurrentLocale();
  
  if (locale.startsWith('el')) {
    switch (status) {
      case 'active': return 'Ενεργό';
      case 'construction': return 'Υπό Κατασκευή';
      case 'planned': return 'Σχεδιασμένο';
      case 'completed': return 'Ολοκληρωμένο';
      default: return status;
    }
  }
  
  // English fallback
  switch (status) {
    case 'active': return 'Active';
    case 'construction': return 'Under Construction';
    case 'planned': return 'Planned';
    case 'completed': return 'Completed';
    default: return status;
  }
};

/**
 * Get price per square meter unit
 */
export const getPricePerSqmUnit = (): string => {
  const locale = getCurrentLocale();
  return locale.startsWith('el') ? '€/τ.μ.' : '€/m²';
};

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
 * Format date in long format (e.g. "13 Δεκεμβρίου 2025") - Replaces obligations-utils.ts formatDate
 *
 * @param dateInput - Date object (required)
 * @returns Long formatted date or fallback
 *
 * @example formatDateLong(new Date()) // "13 Δεκεμβρίου 2025"
 * @example formatDateLong(invalidDate) // "-"
 */
export const formatDateLong = (dateInput: Date): string => {
  if (!dateInput || isNaN(dateInput.getTime())) return '-';

  return formatDate(dateInput, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
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