import type { UseSemanticColorsReturn } from '@/hooks/useSemanticColors';

/**
 * ✅ ENTERPRISE PATTERN: Dependency Injection
 * Αντί να καλώ useSemanticColors() hook εδώ (violation των Rules of Hooks),
 * περνώ τα colors ως παράμετρο από το component που καλεί τη function.
 */
export const getPropertyStatusConfig = (colors: UseSemanticColorsReturn) => {
  return {
    'for-sale': {
      label: 'Προς Πώληση',
      color: `${colors.status.success.bg} ${colors.status.success.text} ${colors.status.success.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'for-rent': {
      label: 'Προς Ενοικίαση',
      color: `${colors.status.info.bg} ${colors.status.info.text} ${colors.status.info.border}`,
      priceLabel: 'Μηνιαίο Μίσθωμα'
    },
    'sold': {
      label: 'Πουλημένο',
      color: `${colors.status.error.bg} ${colors.status.error.text} ${colors.status.error.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'rented': {
      label: 'Ενοικιασμένο',
      color: `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`,
      priceLabel: 'Μηνιαίο Μίσθωμα'
    },
    'reserved': {
      label: 'Δεσμευμένο',
      color: `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'Άγνωστο': {
      label: 'Άγνωστο',
      color: `${colors.status.muted.bg} ${colors.status.muted.text} ${colors.status.muted.border}`,
      priceLabel: 'Τιμή'
    },
  } as const;
};

/**
 * ⚠️ DEPRECATED: Για backward compatibility ΜΟΝΟ
 * Αυτό θα αφαιρεθεί σε μελλοντική έκδοση.
 * Χρησιμοποίησε getPropertyStatusConfig(colors) αντί για αυτό.
 */
export const statusConfig = {} as any; // Empty για να μην σπάσει compilation
