/**
 * Period Selector Configuration - Single Source of Truth
 *
 * Enterprise-class centralized configuration για τις περιόδους του PeriodSelector.
 * Χρησιμοποιεί το ίδιο architecture pattern με τις καρτέλες.
 *
 * @author Claude AI Assistant
 * @created 2024-11-28
 * @version 1.0.0
 */

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

/**
 * Interface για τη διαμόρφωση μίας περιόδου
 */
export interface PeriodConfig {
  /** Unique identifier για την περίοδο */
  id: string;

  /** Εμφανιζόμενη ετικέτα */
  label: string;

  /** Τιμή για την περίοδο */
  value: string;

  /** Περιγραφή της περιόδου (για documentation) */
  description?: string;

  /** Σειρά εμφάνισης */
  order: number;

  /** Αν η περίοδος είναι ενεργή */
  enabled: boolean;

  /** Feature flags */
  featureFlag?: string;

  /** Conditional rendering logic */
  condition?: string;
}

// ============================================================================
// PERIOD SELECTOR CONFIGURATION
// ============================================================================

/**
 * Κεντρική διαμόρφωση όλων των περιόδων
 *
 * ΣΗΜΑΝΤΙΚΟ: Αυτή είναι η ΜΟΝΑΔΙΚΗ πηγή αλήθειας για τις περιόδους!
 * Οποιαδήποτε αλλαγή στις περιόδους πρέπει να γίνεται ΕΔΩ και μόνο εδώ.
 *
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 * Labels are translated at runtime by components using useTranslation
 */
export const PERIOD_SELECTOR_PERIODS: PeriodConfig[] = [
  {
    id: 'day',
    label: 'periods.day',
    value: 'day',
    description: 'periods.dayDescription',
    order: 1,
    enabled: true,
  },
  {
    id: 'week',
    label: 'periods.week',
    value: 'week',
    description: 'periods.weekDescription',
    order: 2,
    enabled: true,
  },
  {
    id: 'month',
    label: 'periods.month',
    value: 'month',
    description: 'periods.monthDescription',
    order: 3,
    enabled: true,
  },
  {
    id: 'year',
    label: 'periods.year',
    value: 'year',
    description: 'periods.yearDescription',
    order: 4,
    enabled: true,
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Επιστρέφει όλες τις ενεργές περιόδους ταξινομημένες κατά order
 */
export function getSortedPeriods(): PeriodConfig[] {
  return PERIOD_SELECTOR_PERIODS
    .filter(period => period.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Επιστρέφει μόνο τις enabled περιόδους
 */
export function getEnabledPeriods(): PeriodConfig[] {
  return PERIOD_SELECTOR_PERIODS.filter(period => period.enabled);
}

/**
 * Βρίσκει μία περίοδο με βάση το ID
 */
export function getPeriodById(id: string): PeriodConfig | undefined {
  return PERIOD_SELECTOR_PERIODS.find(period => period.id === id);
}

/**
 * Βρίσκει μία περίοδο με βάση το value
 */
export function getPeriodByValue(value: string): PeriodConfig | undefined {
  return PERIOD_SELECTOR_PERIODS.find(period => period.value === value);
}

/**
 * Επιστρέφει όλες τις διαθέσιμες περιόδους (enabled/disabled)
 */
export function getAllPeriods(): PeriodConfig[] {
  return [...PERIOD_SELECTOR_PERIODS];
}

/**
 * Επιστρέφει περιόδους που ταιριάζουν σε συγκεκριμένα criteria
 */
export function getPeriodsByCondition(
  predicate: (period: PeriodConfig) => boolean
): PeriodConfig[] {
  return PERIOD_SELECTOR_PERIODS.filter(predicate);
}

/**
 * Επιστρέφει στατιστικά των περιόδων
 */
export function getPeriodsStats() {
  const all = PERIOD_SELECTOR_PERIODS;
  const enabled = getEnabledPeriods();

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    values: [...new Set(all.map(period => period.value))],
    labels: [...new Set(all.map(period => period.label))],
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Ελέγχει αν όλες οι περίοδοι έχουν μοναδικά IDs
 */
export function validatePeriodIds(): boolean {
  const ids = PERIOD_SELECTOR_PERIODS.map(period => period.id);
  return ids.length === new Set(ids).size;
}

/**
 * Ελέγχει αν όλες οι περίοδοι έχουν μοναδικά values
 */
export function validatePeriodValues(): boolean {
  const values = PERIOD_SELECTOR_PERIODS.map(period => period.value);
  return values.length === new Set(values).size;
}

/**
 * Ελέγχει αν όλες οι περίοδοι έχουν μοναδικά orders
 */
export function validatePeriodOrders(): boolean {
  const orders = PERIOD_SELECTOR_PERIODS.map(period => period.order);
  return orders.length === new Set(orders).size;
}

/**
 * Comprehensive validation όλων των περιόδων
 */
export function validatePeriodConfiguration(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!validatePeriodIds()) {
    errors.push('Duplicate period IDs found');
  }

  if (!validatePeriodValues()) {
    errors.push('Duplicate period values found');
  }

  if (!validatePeriodOrders()) {
    errors.push('Duplicate period orders found');
  }

  // Έλεγχος για κενά required fields
  PERIOD_SELECTOR_PERIODS.forEach((period, index) => {
    if (!period.id) errors.push(`Period at index ${index} has no ID`);
    if (!period.label) errors.push(`Period at index ${index} has no label`);
    if (!period.value) errors.push(`Period at index ${index} has no value`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Development helper για debugging
 */
export function debugPeriods(): void {
  if (process.env.NODE_ENV === 'development') {
    console.group('📅 Period Selector Configuration Debug');
    console.log('📊 Stats:', getPeriodsStats());
    console.log('✅ Validation:', validatePeriodConfiguration());
    console.log('📋 Enabled periods:', getEnabledPeriods().map(p => p.label));
    console.log('🎯 All periods:', PERIOD_SELECTOR_PERIODS.length);
    console.groupEnd();
  }
}

// 🔕 Development debug disabled to reduce console noise (2026-01-31)
// Call debugPeriods() manually if needed
// if (process.env.NODE_ENV === 'development') {
//   debugPeriods();
// }

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  periods: PERIOD_SELECTOR_PERIODS,
  getSorted: getSortedPeriods,
  getEnabled: getEnabledPeriods,
  getById: getPeriodById,
  getByValue: getPeriodByValue,
  getAll: getAllPeriods,
  getByCondition: getPeriodsByCondition,
  getStats: getPeriodsStats,
  validate: validatePeriodConfiguration,
  debug: debugPeriods,
};
