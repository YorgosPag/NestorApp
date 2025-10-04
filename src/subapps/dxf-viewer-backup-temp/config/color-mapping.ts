import type { PropertyStatus } from '../../../constants/statuses';

// 🔺 ΕΝΙΑΊΟΣ STATUS_COLORS MAPPER - κεντρική αλήθεια για όλα τα overlay colors
// Μετατρέπει τα κεντρικά CSS variables σε concrete hex colors για canvas rendering
export const STATUS_COLORS_MAPPING: Record<PropertyStatus, { stroke: string; fill: string }> = {
  'for-sale': { stroke: '#22c55e', fill: '#22c55e80' },    // Green - success
  'for-rent': { stroke: '#3b82f6', fill: '#3b82f680' },    // Blue - info
  'reserved': { stroke: '#f59e0b', fill: '#f59e0b80' },    // Orange - warning
  'sold': { stroke: '#ef4444', fill: '#ef444480' },        // Red - error
  'landowner': { stroke: '#8b5cf6', fill: '#8b5cf680' },   // Purple - special
};

// Helper function για backward compatibility
export const BUTTON_STATUS_COLORS: Record<PropertyStatus, string> = Object.fromEntries(
  Object.entries(STATUS_COLORS_MAPPING).map(([status, colors]) => [status, colors.stroke])
) as Record<PropertyStatus, string>;

// 🔺 ΚΕΝΤΡΙΚΟΣ MAPPER: Ελληνικά → Αγγλικά status names
// Χρησιμοποιεί τα κεντρικά PROPERTY_STATUS_LABELS για consistency
import { PROPERTY_STATUS_LABELS } from '../../../constants/statuses';
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