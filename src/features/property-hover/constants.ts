import type { UseSemanticColorsReturn } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: Import centralized property status labels - NO MORE HARDCODED VALUES
import { getPropertySpecialStatusLabels } from '@/subapps/dxf-viewer/config/modal-select';

/**
 * ✅ ENTERPRISE PATTERN: Dependency Injection
 * Αντί να καλώ useSemanticColors() hook εδώ (violation των Rules of Hooks),
 * περνώ τα colors ως παράμετρο από το component που καλεί τη function.
 */
export const getPropertyStatusConfig = (colors: UseSemanticColorsReturn) => {
  // 🏢 ENTERPRISE: Get centralized property status labels
  const statusLabels = getPropertySpecialStatusLabels();

  return {
    'for-sale': {
      label: statusLabels.for_sale,
      color: `${colors.status.success.bg} ${colors.status.success.text} ${colors.status.success.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'for-rent': {
      label: statusLabels.for_rent,
      color: `${colors.status.info.bg} ${colors.status.info.text} ${colors.status.info.border}`,
      priceLabel: 'Μηνιαίο Μίσθωμα'
    },
    'sold': {
      label: statusLabels.sold,
      color: `${colors.status.error.bg} ${colors.status.error.text} ${colors.status.error.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'rented': {
      label: statusLabels.rented,
      color: `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`,
      priceLabel: 'Μηνιαίο Μίσθωμα'
    },
    'reserved': {
      label: statusLabels.reserved,
      color: `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`,
      priceLabel: 'Τιμή Πώλησης'
    },
    'Άγνωστο': {
      label: statusLabels.unknown,
      color: `${colors.status.muted.bg} ${colors.status.muted.text} ${colors.status.muted.border}`,
      priceLabel: 'Τιμή'
    },
  } as const;
};

/**
 * ⚠️ DEPRECATED: Για backward compatibility ΜΟΝΟ
 * Αυτό θα αφαιρεθεί σε μελλοντική έκδοση.
 * Χρησιμοποίησε getPropertyStatusConfig(colors) αντί για αυτό.
 * 🏢 ENTERPRISE: Type-safe empty object with proper typing
 */
export const statusConfig: Record<string, never> = {}; // Empty για να μην σπάσει compilation
