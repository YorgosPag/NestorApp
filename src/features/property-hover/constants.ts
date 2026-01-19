// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
import type { UseSemanticColorsReturn } from '@/hooks/useSemanticColors';
// 🏢 ENTERPRISE: Import centralized property status labels from enterprise source
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';

/**
 * ✅ ENTERPRISE PATTERN: Dependency Injection
 * Αντί να καλώ useSemanticColors() hook εδώ (violation των Rules of Hooks),
 * περνώ τα colors ως παράμετρο από το component που καλεί τη function.
 *
 * 🏢 ENTERPRISE FIX (2026-01-19): Use proper semantic color mapping
 * StatusColorPatterns has: active, inactive, pending, completed, cancelled
 * Mapping to semantic status colors for property statuses:
 * - for-sale/available → active (green)
 * - for-rent → pending (yellow/blue)
 * - sold → cancelled (red)
 * - rented/reserved → completed (blue)
 * - unknown → inactive (gray)
 */
export const getPropertyStatusConfig = (colors: UseSemanticColorsReturn) => {
  return {
    'for-sale': {
      label: PROPERTY_STATUS_LABELS['for-sale'],
      // 🏢 ENTERPRISE: Map to 'active' status (green - available for transaction)
      color: `${colors.status.active.bg} ${colors.status.active.text} ${colors.status.active.border}`,
      priceLabel: 'properties.priceLabels.salePrice' // i18n key
    },
    'for-rent': {
      label: PROPERTY_STATUS_LABELS['for-rent'],
      // 🏢 ENTERPRISE: Map to 'pending' status (yellow/blue - active listing)
      color: `${colors.status.pending.bg} ${colors.status.pending.text} ${colors.status.pending.border}`,
      priceLabel: 'properties.priceLabels.monthlyRent' // i18n key
    },
    'sold': {
      label: PROPERTY_STATUS_LABELS['sold'],
      // 🏢 ENTERPRISE: Map to 'cancelled' status (red - no longer available)
      color: `${colors.status.cancelled.bg} ${colors.status.cancelled.text} ${colors.status.cancelled.border}`,
      priceLabel: 'properties.priceLabels.salePrice' // i18n key
    },
    'rented': {
      label: PROPERTY_STATUS_LABELS['rented'],
      // 🏢 ENTERPRISE: Map to 'completed' status (blue - transaction complete)
      color: `${colors.status.completed.bg} ${colors.status.completed.text} ${colors.status.completed.border}`,
      priceLabel: 'properties.priceLabels.monthlyRent' // i18n key
    },
    'reserved': {
      label: PROPERTY_STATUS_LABELS['reserved'],
      // 🏢 ENTERPRISE: Map to 'pending' status (yellow - pending completion)
      color: `${colors.status.pending.bg} ${colors.status.pending.text} ${colors.status.pending.border}`,
      priceLabel: 'properties.priceLabels.salePrice' // i18n key
    },
    'unknown': {
      label: 'properties.status.unknown', // i18n key for unknown status
      // 🏢 ENTERPRISE: Map to 'inactive' status (gray - no status)
      color: `${colors.status.inactive.bg} ${colors.status.inactive.text} ${colors.status.inactive.border}`,
      priceLabel: 'properties.priceLabels.price' // i18n key
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
