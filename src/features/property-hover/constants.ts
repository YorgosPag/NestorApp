// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// 🏢 ENTERPRISE: Import centralized property status labels from enterprise source
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';

/**
 * 🏢 ENTERPRISE: Status Color Mapping (Tailwind classes)
 *
 * Maps commercial statuses to Tailwind utility classes.
 * Previously used colors.status.* from useSemanticColors, but that was
 * removed during the design-system migration (color-bridge). Now uses
 * Tailwind classes directly — same visual result, zero runtime dependency.
 */
const STATUS_COLORS = {
  active: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  pending: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/30',
  },
  cancelled: {
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/30',
  },
  completed: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
  inactive: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  // 🏢 ADR-258: Teal for dual listing (for-sale-and-rent)
  teal: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-400',
    border: 'border-teal-500/30',
  },
} as const;

/**
 * ✅ ENTERPRISE PATTERN: Property Status Config
 *
 * Returns status display configuration (label, color classes, price label).
 * No hook dependency — safe to call from any context.
 */
export function getPropertyHoverStatusConfig() {
  return {
    'for-sale': {
      label: PROPERTY_STATUS_LABELS['for-sale'],
      color: `${STATUS_COLORS.active.bg} ${STATUS_COLORS.active.text} ${STATUS_COLORS.active.border}`,
      priceLabel: 'properties.priceLabels.salePrice',
    },
    'for-rent': {
      label: PROPERTY_STATUS_LABELS['for-rent'],
      color: `${STATUS_COLORS.completed.bg} ${STATUS_COLORS.completed.text} ${STATUS_COLORS.completed.border}`,
      priceLabel: 'properties.priceLabels.monthlyRent',
    },
    'sold': {
      label: PROPERTY_STATUS_LABELS['sold'],
      color: `${STATUS_COLORS.cancelled.bg} ${STATUS_COLORS.cancelled.text} ${STATUS_COLORS.cancelled.border}`,
      priceLabel: 'properties.priceLabels.salePrice',
    },
    'rented': {
      label: PROPERTY_STATUS_LABELS['rented'],
      color: `${STATUS_COLORS.cancelled.bg} ${STATUS_COLORS.cancelled.text} ${STATUS_COLORS.cancelled.border}`,
      priceLabel: 'properties.priceLabels.monthlyRent',
    },
    'reserved': {
      label: PROPERTY_STATUS_LABELS['reserved'],
      color: `${STATUS_COLORS.pending.bg} ${STATUS_COLORS.pending.text} ${STATUS_COLORS.pending.border}`,
      priceLabel: 'properties.priceLabels.salePrice',
    },
    // 🏢 ADR-258: Dual listing (for-sale-and-rent) — Teal styling
    'for-sale-and-rent': {
      label: PROPERTY_STATUS_LABELS['for-sale-and-rent'],
      color: `${STATUS_COLORS.teal.bg} ${STATUS_COLORS.teal.text} ${STATUS_COLORS.teal.border}`,
      priceLabel: 'properties.priceLabels.salePrice',
    },
    // 🏢 ENTERPRISE: Unavailable / off-market
    'unavailable': {
      label: PROPERTY_STATUS_LABELS['unavailable'],
      color: `${STATUS_COLORS.inactive.bg} ${STATUS_COLORS.inactive.text} ${STATUS_COLORS.inactive.border}`,
      priceLabel: 'properties.priceLabels.price',
    },
    // Legacy status — mapped to for-sale semantics
    'available': {
      label: PROPERTY_STATUS_LABELS['for-sale'],
      color: `${STATUS_COLORS.active.bg} ${STATUS_COLORS.active.text} ${STATUS_COLORS.active.border}`,
      priceLabel: 'properties.priceLabels.salePrice',
    },
    'unknown': {
      label: 'properties.status.unknown',
      color: `${STATUS_COLORS.inactive.bg} ${STATUS_COLORS.inactive.text} ${STATUS_COLORS.inactive.border}`,
      priceLabel: 'properties.priceLabels.price',
    },
  } as const;
}

