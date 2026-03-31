import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';
import { UI_COLORS, withOpacity } from './color-config';

// 🔺 ΕΝΙΑΊΟΣ STATUS_COLORS MAPPER - κεντρική αλήθεια για όλα τα overlay colors
// Μετατρέπει τα κεντρικά CSS variables σε concrete hex colors για canvas rendering
export const STATUS_COLORS_MAPPING: Record<PropertyStatus, { stroke: string; fill: string }> = {
  'for-sale': { stroke: UI_COLORS.SUCCESS, fill: withOpacity(UI_COLORS.SUCCESS, 0.5) },    // 🟢 Green - success
  'for-rent': { stroke: UI_COLORS.INFO, fill: withOpacity(UI_COLORS.INFO, 0.5) },    // 🔵 Blue - info
  'for-sale-and-rent': { stroke: UI_COLORS.TEAL, fill: withOpacity(UI_COLORS.TEAL, 0.5) }, // 🩵 Teal - dual listing (ADR-258)
  'reserved': { stroke: UI_COLORS.WARNING, fill: withOpacity(UI_COLORS.WARNING, 0.5) },    // 🟡 Orange - warning
  'sold': { stroke: UI_COLORS.ERROR, fill: withOpacity(UI_COLORS.ERROR, 0.5) },        // 🔴 Red - error
  'landowner': { stroke: UI_COLORS.LIGHT_PURPLE, fill: withOpacity(UI_COLORS.LIGHT_PURPLE, 0.5) },   // 🟣 Purple - special
  // 🏠 Phase 2.5: Real Estate Innovation System - Enhanced Canvas Colors
  'rented': { stroke: UI_COLORS.DARK_RED, fill: withOpacity(UI_COLORS.DARK_RED, 0.5) },      // 🔴 Dark Red - rented
  'under-negotiation': { stroke: UI_COLORS.LIGHT_ORANGE, fill: withOpacity(UI_COLORS.LIGHT_ORANGE, 0.5) }, // 🟡 Light Orange - negotiation
  'coming-soon': { stroke: UI_COLORS.LIGHT_PURPLE, fill: withOpacity(UI_COLORS.LIGHT_PURPLE, 0.5) }, // 🟣 Light Purple - coming soon
  'off-market': { stroke: UI_COLORS.LIGHT_GRAY, fill: withOpacity(UI_COLORS.LIGHT_GRAY, 0.375) },  // ⚪ Gray - off market
  'unavailable': { stroke: UI_COLORS.DARK_GRAY, fill: withOpacity(UI_COLORS.DARK_GRAY, 0.375) }, // ⚫ Dark Gray - unavailable
};

// Helper function για backward compatibility
export const BUTTON_STATUS_COLORS: Record<PropertyStatus, string> = Object.fromEntries(
  Object.entries(STATUS_COLORS_MAPPING).map(([status, colors]) => [status, colors.stroke])
) as Record<PropertyStatus, string>;

// 🔺 ΚΕΝΤΡΙΚΟΣ MAPPER: Ελληνικά → Αγγλικά status names
// Χρησιμοποιεί τα κεντρικά PROPERTY_STATUS_LABELS για consistency
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS } from '../../../constants/property-statuses-enterprise';
const GREEK_TO_ENGLISH_STATUS: Record<string, PropertyStatus> = Object.fromEntries(
  Object.entries(PROPERTY_STATUS_LABELS).map(([english, greek]) => [greek, english as PropertyStatus])
) as Record<string, PropertyStatus>;

// Helper function να βρει το σωστό χρώμα για οποιοδήποτε status (ελληνικό ή αγγλικό)
export function getStatusColors(status: string): { stroke: string; fill: string } | null {
  // Δοκίμασε αγγλικό πρώτα
  if (status in STATUS_COLORS_MAPPING) {
    return STATUS_COLORS_MAPPING[status as PropertyStatus];
  }

  // Αν είναι ελληνικό, μετάτρεψε σε αγγλικό
  const englishStatus = GREEK_TO_ENGLISH_STATUS[status];
  if (englishStatus && englishStatus in STATUS_COLORS_MAPPING) {
    return STATUS_COLORS_MAPPING[englishStatus];
  }

  return null;
}

// 🔺 ΚΕΝΤΡΙΚΟΣ KIND MAPPER: Ελληνικά → Αγγλικά kind names
// Χρησιμοποιεί τα κεντρικά KIND_LABELS για consistency
import { KIND_LABELS, type OverlayKind } from '../overlays/types';
const GREEK_TO_ENGLISH_KIND: Record<string, OverlayKind> = Object.fromEntries(
  Object.entries(KIND_LABELS).map(([english, greek]) => [greek, english as OverlayKind])
) as Record<string, OverlayKind>;

// Helper function να βρει το σωστό kind για οποιοδήποτε label (ελληνικό ή αγγλικό)
export function getKindFromLabel(label: string): OverlayKind | null {
  // Δοκίμασε αν είναι ήδη αγγλικό kind value (unit, parking, storage, footprint)
  if ((Object.keys(KIND_LABELS) as OverlayKind[]).includes(label as OverlayKind)) {
    return label as OverlayKind;
  }

  // Αν είναι ελληνικό label (Μονάδα, Parking, Αποθήκη, Αποτύπωμα), μετάτρεψε σε αγγλικό
  const englishKind = GREEK_TO_ENGLISH_KIND[label];
  if (englishKind) {
    return englishKind;
  }

  return null;
}

// ============================================================================
// 🏢 ADR-258: CommercialStatus → PropertyStatus Mapping (Twin Architecture)
// ============================================================================
// Κεντρική mapping function — parking/storage χρησιμοποιούν SpaceCommercialStatus
// (υποσύνολο του CommercialStatus, χωρίς for-rent/for-sale-and-rent/rented)
import type { CommercialStatus } from '../../../types/property';
import type { SpaceCommercialStatus } from '../../../types/sales-shared';

const COMMERCIAL_TO_PROPERTY_STATUS: Record<string, PropertyStatus> = {
  'for-sale': 'for-sale',
  'for-rent': 'for-rent',
  'for-sale-and-rent': 'for-sale-and-rent',
  'reserved': 'reserved',
  'sold': 'sold',
  'rented': 'rented',
  'unavailable': 'unavailable',
};

export function commercialToPropertyStatus(
  status: CommercialStatus | SpaceCommercialStatus | undefined
): PropertyStatus {
  if (!status) return 'unavailable';
  return COMMERCIAL_TO_PROPERTY_STATUS[status] ?? 'unavailable';
}