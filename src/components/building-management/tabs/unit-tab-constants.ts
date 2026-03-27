/* eslint-disable design-system/enforce-semantic-colors */
/**
 * Unit tab constants — SSOT for labels and option arrays.
 *
 * Used by: UnitsTabContent, UnitInlineCreateForm
 * @module components/building-management/tabs/unit-tab-constants
 */

import type { UnitType, CommercialStatus, OperationalStatus } from '@/types/unit';

// ============================================================================
// TYPE LABELS & OPTIONS
// ============================================================================

export const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'Διαμέρισμα',
  studio: 'Στούντιο',
  apartment_1br: 'Γκαρσονιέρα',
  apartment_2br: 'Διαμέρισμα 2Δ',
  apartment_3br: 'Διαμέρισμα 3Δ',
  maisonette: 'Μεζονέτα',
  shop: 'Κατάστημα',
  office: 'Γραφείο',
  storage: 'Αποθήκη',
};

export const UNIT_TYPES_FOR_FILTER: UnitType[] = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br', 'apartment_3br',
  'maisonette', 'shop', 'office', 'storage',
];

// ============================================================================
// STATUS LABELS & OPTIONS
// ============================================================================

export const UNIT_STATUS_LABELS: Record<string, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  sold: 'Πωλημένη',
  reserved: 'Δεσμευμένη',
  rented: 'Ενοικιασμένη',
  'under-negotiation': 'Υπό Διαπραγμάτευση',
  unavailable: 'Μη Διαθέσιμη',
};

export const UNIT_STATUSES_FOR_FILTER = [
  'for-sale', 'for-rent', 'sold', 'reserved', 'rented', 'under-negotiation', 'unavailable',
] as const;

/** ADR-197: Commercial statuses allowed at creation (reserved/sold via sales flow) */
export const CREATION_COMMERCIAL_OPTIONS: { value: CommercialStatus; label: string }[] = [
  { value: 'unavailable', label: 'Μη Διαθέσιμη' },
  { value: 'for-sale', label: 'Προς Πώληση' },
  { value: 'for-rent', label: 'Προς Ενοικίαση' },
];

export const OPERATIONAL_STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
  { value: 'draft', label: 'Πρόχειρο' },
  { value: 'under-construction', label: 'Υπό Κατασκευή' },
  { value: 'ready', label: 'Έτοιμο' },
  { value: 'inspection', label: 'Επιθεώρηση' },
  { value: 'maintenance', label: 'Συντήρηση' },
];

// ============================================================================
// SHARED TYPES
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

export function getUnitTypeLabel(type: string): string {
  return UNIT_TYPE_LABELS[type] || type;
}

export const UNIT_STATUS_COLOR_MAP: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'for-sale': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'for-rent': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  rented: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'under-negotiation': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  unavailable: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface FloorRecord {
  id: string;
  number: number;
  name: string;
}
