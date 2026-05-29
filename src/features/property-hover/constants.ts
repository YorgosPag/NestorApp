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
    bg: 'bg-[hsl(var(--bg-success))]/10',
    text: 'text-[hsl(var(--text-success))]',
    border: 'border-border',
  },
  pending: {
    bg: 'bg-[hsl(var(--bg-warning))]/40',
    text: 'text-[hsl(var(--text-warning))]',
    border: 'border-border',
  },
  cancelled: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
  },
  completed: {
    bg: 'bg-[hsl(var(--bg-info))]/20',
    text: 'text-primary',
    border: 'border-border',
  },
  inactive: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  // 🏢 ADR-258: Teal for dual listing (for-sale-and-rent) → bg-accent (visual differentiation)
  teal: {
    bg: 'bg-accent',
    text: 'text-primary',
    border: 'border-border',
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

