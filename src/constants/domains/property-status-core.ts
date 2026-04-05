/**
 * PROPERTY STATUS CORE
 *
 * Core property status types, labels, colors, categories, and utility functions.
 * Single Source of Truth for property status management across the application.
 *
 * @domain Property Status Management
 * @consumers 30+ files
 */

// ============================================================================
// CORE PROPERTY STATUS DEFINITIONS
// ============================================================================

export type PropertyStatus =
  | 'for-sale'
  | 'for-rent'
  | 'for-sale-and-rent' // Πώληση & Ενοικίαση (ADR-258: Twin Architecture)
  | 'reserved'
  | 'sold'
  | 'landowner'
  | 'rented'           // Ενοικιάστηκε
  | 'under-negotiation' // Υπό διαπραγμάτευση
  | 'coming-soon'      // Σύντομα διαθέσιμο
  | 'off-market'       // Εκτός αγοράς
  | 'unavailable'      // Μη διαθέσιμο
  | 'deleted';         // ADR-281: Soft-deleted (στον κάδο)

// i18n keys for property status labels
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  'for-sale': 'properties:status.forSale',
  'for-rent': 'properties:status.forRent',
  'for-sale-and-rent': 'properties:status.forSaleAndRent',
  'reserved': 'properties:status.reserved',
  'sold': 'properties:status.sold',
  'landowner': 'properties:status.landowner',
  'rented': 'properties:status.rented',
  'under-negotiation': 'properties:status.underNegotiation',
  'coming-soon': 'properties:status.comingSoon',
  'off-market': 'properties:status.offMarket',
  'unavailable': 'properties:status.unavailable',
  'deleted': 'properties:status.deleted',
};

export const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  'for-sale': 'hsl(var(--status-success))',
  'for-rent': 'hsl(var(--status-info))',
  'for-sale-and-rent': 'hsl(var(--status-teal))',
  'reserved': 'hsl(var(--status-warning))',
  'sold': 'hsl(var(--status-error))',
  'landowner': 'hsl(var(--status-purple))',
  'rented': 'hsl(var(--status-error-dark))',
  'under-negotiation': 'hsl(var(--status-warning-light))',
  'coming-soon': 'hsl(var(--status-purple-light))',
  'off-market': 'hsl(var(--neutral-400))',
  'unavailable': 'hsl(var(--neutral-500))',
  'deleted': 'hsl(var(--neutral-300))',
};

export const DEFAULT_PROPERTY_STATUS: PropertyStatus = 'for-sale';

// ============================================================================
// PROPERTY TYPES & LABELS
// ============================================================================

// ADR-145: PropertyType SSoT lives at @/constants/property-types.
// This module re-exports the canonical type for backward compatibility —
// legacy consumers (TypeSelect.tsx, features/property-grid) continue to work.
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_I18N_KEYS,
  type PropertyTypeCanonical,
} from '@/constants/property-types';

export type PropertyType = PropertyTypeCanonical;

/**
 * i18n label keys για όλους τους 14 canonical property types.
 * ADR-145: Derived από SSoT. Keys χρησιμοποιούν UNDERSCORES αποκλειστικά
 * (π.χ. `apartment_2br`, ΟΧΙ `apartment-2br`). Prefix `properties.` για
 * το UI resolution: `t(`properties.${PROPERTY_TYPE_LABELS[type]}`)`.
 */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = Object.fromEntries(
  PROPERTY_TYPES.map((type) => [type, `properties.${PROPERTY_TYPE_I18N_KEYS[type]}`]),
) as Record<PropertyType, string>;

/**
 * @deprecated ADR-145: Use `PROPERTY_TYPE_LABELS` directly (τώρα πλήρες — 14 types).
 * Διατηρείται ως alias για καλύτερη backward compatibility. Προηγούμενες εκδόσεις
 * αυτού του map είχαν hyphenated keys (`apartment-2br`) που ΔΕΝ ήταν συμβατά με
 * τον canonical PropertyType union (underscore form).
 */
export const EXTENDED_PROPERTY_TYPE_LABELS = PROPERTY_TYPE_LABELS;

// Legacy status mapping for compatibility
export const LEGACY_STATUS_MAPPING: Record<string, PropertyStatus> = {
  'available': 'for-sale',
  'sold': 'sold',
  'reserved': 'reserved',
  'owner': 'landowner'
};

// ============================================================================
// ENHANCED STATUS TYPES
// ============================================================================

/**
 * Enterprise Enhanced Property Status
 *
 * Επεκτείνει τα βασικά PropertyStatus με επιπλέον επαγγελματικές καταστάσεις
 * που απαιτούνται για ολοκληρωμένη διαχείριση real estate portfolio
 */
export type EnhancedPropertyStatus = PropertyStatus
  // Advanced Rental Statuses
  | 'rental-only'
  | 'long-term-rental'
  | 'short-term-rental'
  // Advanced Reservation Statuses
  | 'reserved-pending'
  | 'contract-signed'
  | 'deposit-paid'
  // Ownership Statuses
  | 'company-owned'
  | 'not-for-sale'
  | 'family-reserved'
  // Market Dynamics
  | 'pre-launch'
  | 'exclusive-listing'
  | 'price-reduced'
  | 'urgent-sale'
  // Operational Statuses
  | 'under-renovation'
  | 'legal-issues'
  | 'inspection-required'
  | 'documentation-pending';

// ============================================================================
// BUSINESS INTENT CATEGORIZATION
// ============================================================================

/**
 * Property Intent — What the owner wants to do with the property
 */
export type PropertyIntent =
  | 'sale'
  | 'rental'
  | 'both'
  | 'investment'
  | 'development'
  | 'internal'
  | 'withdrawn';

/**
 * Market Availability — Is the property currently on the market?
 */
export type MarketAvailability =
  | 'immediately-available'
  | 'available-soon'
  | 'conditionally-available'
  | 'reserved'
  | 'occupied'
  | 'off-market'
  | 'not-available';

/**
 * Property Priority — How urgent is the sale/rent
 */
export type PropertyPriority =
  | 'high'
  | 'medium'
  | 'low'
  | 'showcase'
  | 'hold';

// ============================================================================
// ENHANCED STATUS LABELS & COLORS
// ============================================================================

export const ENHANCED_STATUS_LABELS: Record<EnhancedPropertyStatus, string> = {
  ...PROPERTY_STATUS_LABELS,
  // Advanced Rental Statuses
  'rental-only': 'properties.enhancedStatus.rentalOnly',
  'long-term-rental': 'properties.enhancedStatus.longTermRental',
  'short-term-rental': 'properties.enhancedStatus.shortTermRental',
  // Advanced Reservation Statuses
  'reserved-pending': 'properties.enhancedStatus.reservedPending',
  'contract-signed': 'properties.enhancedStatus.contractSigned',
  'deposit-paid': 'properties.enhancedStatus.depositPaid',
  // Ownership Statuses
  'company-owned': 'properties.enhancedStatus.companyOwned',
  'not-for-sale': 'properties.enhancedStatus.notForSale',
  'family-reserved': 'properties.enhancedStatus.familyReserved',
  // Market Dynamics
  'pre-launch': 'properties.enhancedStatus.preLaunch',
  'exclusive-listing': 'properties.enhancedStatus.exclusiveListing',
  'price-reduced': 'properties.enhancedStatus.priceReduced',
  'urgent-sale': 'properties.enhancedStatus.urgentSale',
  // Operational Statuses
  'under-renovation': 'properties.enhancedStatus.underRenovation',
  'legal-issues': 'properties.enhancedStatus.legalIssues',
  'inspection-required': 'properties.enhancedStatus.inspectionRequired',
  'documentation-pending': 'properties.enhancedStatus.documentationPending',
};

export const ENHANCED_STATUS_COLORS: Record<EnhancedPropertyStatus, string> = {
  ...PROPERTY_STATUS_COLORS,
  // Advanced Rental Colors (Blue variants)
  'rental-only': 'hsl(var(--status-info-dark))',
  'long-term-rental': 'hsl(var(--status-info))',
  'short-term-rental': 'hsl(var(--status-info-light))',
  // Advanced Reservation Colors (Orange variants)
  'reserved-pending': 'hsl(var(--status-warning-light))',
  'contract-signed': 'hsl(var(--status-warning-dark))',
  'deposit-paid': 'hsl(var(--status-warning))',
  // Ownership Colors (Purple variants)
  'company-owned': 'hsl(var(--status-purple-dark))',
  'not-for-sale': 'hsl(var(--status-purple))',
  'family-reserved': 'hsl(var(--status-purple-light))',
  // Market Dynamics Colors (Green/Cyan variants)
  'pre-launch': 'hsl(var(--status-success-light))',
  'exclusive-listing': 'hsl(var(--status-success-dark))',
  'price-reduced': 'hsl(var(--destructive-light))',
  'urgent-sale': 'hsl(var(--destructive))',
  // Operational Colors (Neutral/Gray variants)
  'under-renovation': 'hsl(var(--neutral-600))',
  'legal-issues': 'hsl(var(--destructive-dark))',
  'inspection-required': 'hsl(var(--neutral-500))',
  'documentation-pending': 'hsl(var(--neutral-400))',
};

// Intent labels
export const PROPERTY_INTENT_LABELS: Record<PropertyIntent, string> = {
  'sale': 'properties.intent.sale',
  'rental': 'properties.intent.rental',
  'both': 'properties.intent.both',
  'investment': 'properties.intent.investment',
  'development': 'properties.intent.development',
  'internal': 'properties.intent.internal',
  'withdrawn': 'properties.intent.withdrawn',
};

// Market availability labels
export const MARKET_AVAILABILITY_LABELS: Record<MarketAvailability, string> = {
  'immediately-available': 'properties.availability.immediatelyAvailable',
  'available-soon': 'properties.availability.availableSoon',
  'conditionally-available': 'properties.availability.conditionallyAvailable',
  'reserved': 'properties.availability.reserved',
  'occupied': 'properties.availability.occupied',
  'off-market': 'properties.availability.offMarket',
  'not-available': 'properties.availability.notAvailable',
};

// Priority labels
export const PROPERTY_PRIORITY_LABELS: Record<PropertyPriority, string> = {
  'high': 'common.priority.high',
  'medium': 'common.priority.medium',
  'low': 'common.priority.low',
  'showcase': 'properties.priority.showcase',
  'hold': 'properties.priority.hold',
};

// ============================================================================
// STATUS CATEGORIES
// ============================================================================

export const STATUS_CATEGORIES = {
  available: [
    'for-sale', 'for-rent', 'for-sale-and-rent',
    'rental-only', 'long-term-rental', 'short-term-rental',
    'pre-launch', 'exclusive-listing', 'price-reduced', 'urgent-sale'
  ] as EnhancedPropertyStatus[],
  committed: [
    'reserved', 'sold', 'rented', 'landowner',
    'reserved-pending', 'contract-signed', 'deposit-paid',
    'company-owned', 'not-for-sale', 'family-reserved'
  ] as EnhancedPropertyStatus[],
  offMarket: [
    'under-negotiation', 'coming-soon', 'off-market', 'unavailable'
  ] as EnhancedPropertyStatus[],
  issues: [
    'under-renovation', 'legal-issues', 'inspection-required', 'documentation-pending'
  ] as EnhancedPropertyStatus[],
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getEnhancedStatusLabel(status: EnhancedPropertyStatus): string {
  return ENHANCED_STATUS_LABELS[status] || status;
}

export function getEnhancedStatusColor(status: EnhancedPropertyStatus): string {
  return ENHANCED_STATUS_COLORS[status] || 'hsl(var(--neutral-400))';
}

export function getStatusCategory(status: EnhancedPropertyStatus): string {
  for (const [category, statuses] of Object.entries(STATUS_CATEGORIES)) {
    if ((statuses as readonly string[]).includes(status)) return category;
  }
  return 'unknown';
}

export function isPropertyAvailable(status: EnhancedPropertyStatus): boolean {
  return (STATUS_CATEGORIES.available as readonly string[]).includes(status);
}

export function isPropertyCommitted(status: EnhancedPropertyStatus): boolean {
  return (STATUS_CATEGORIES.committed as readonly string[]).includes(status);
}

export function isPropertyOffMarket(status: EnhancedPropertyStatus): boolean {
  return (STATUS_CATEGORIES.offMarket as readonly string[]).includes(status);
}

export function hasPropertyIssues(status: EnhancedPropertyStatus): boolean {
  return (STATUS_CATEGORIES.issues as readonly string[]).includes(status);
}

export function getAllEnhancedStatuses(): EnhancedPropertyStatus[] {
  return Object.keys(ENHANCED_STATUS_LABELS) as EnhancedPropertyStatus[];
}

export function getStatusesByCategory(category: keyof typeof STATUS_CATEGORIES): EnhancedPropertyStatus[] {
  return [...STATUS_CATEGORIES[category]];
}

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

export const getStatusLabel = getEnhancedStatusLabel;
export const getStatusColor = getEnhancedStatusColor;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  ENHANCED_STATUS_LABELS,
  ENHANCED_STATUS_COLORS,
  PROPERTY_INTENT_LABELS,
  MARKET_AVAILABILITY_LABELS,
  PROPERTY_PRIORITY_LABELS,
  STATUS_CATEGORIES,
  getEnhancedStatusLabel,
  getEnhancedStatusColor,
  getStatusCategory,
  isPropertyAvailable,
  isPropertyCommitted,
  isPropertyOffMarket,
  hasPropertyIssues,
  getAllEnhancedStatuses,
  getStatusesByCategory,
};
