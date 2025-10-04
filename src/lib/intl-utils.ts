/**
 * Internationalization utilities using native Intl APIs
 * Provides consistent formatting across the application
 */

import i18n from '@/i18n/config';

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
 */
export const formatDateTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  const locale = getCurrentLocale();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
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
 * Format floor label according to locale conventions
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