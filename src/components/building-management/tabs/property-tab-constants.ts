/* eslint-disable design-system/enforce-semantic-colors */
/**
 * Property tab constants — SSOT for labels and option arrays.
 *
 * Label values are i18n translation KEYS (not raw text).
 * Consumers resolve them via t(key), e.g. t(UNIT_TYPE_LABEL_KEYS[type]).
 *
 * Used by: PropertiesTabContent, PropertyInlineCreateForm
 * @module components/building-management/tabs/property-tab-constants
 */

import type { TFunction } from 'i18next';
import type { PropertyType, CommercialStatus, OperationalStatus } from '@/types/property';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';

// ============================================================================
// TYPE LABELS & OPTIONS (i18n keys — resolve with t())
// ============================================================================

/**
 * Maps unit type value → i18n key in "properties" namespace.
 * ADR-145: Derived από canonical SSoT — αυτόματα complete με όλους τους 14 τύπους.
 */
export const UNIT_TYPE_LABEL_KEYS: Record<string, string> = { ...PROPERTY_TYPE_I18N_KEYS };

/**
 * Full list των 14 canonical types για το Properties tab filter dropdown.
 * ADR-145: Derived από canonical SSoT — fixes previous missing penthouse/loft/
 * villa/detached_house/hall (ADR-233 additions που δεν είχαν propagate εδώ).
 */
export const UNIT_TYPES_FOR_FILTER: PropertyType[] = [...PROPERTY_TYPES];

// ============================================================================
// STATUS LABELS & OPTIONS (i18n keys — resolve with t())
// ============================================================================

/** Maps commercial status value → i18n key in "properties" namespace */
export const UNIT_STATUS_LABEL_KEYS: Record<string, string> = {
  'for-sale': 'commercialStatus.for-sale',
  'for-rent': 'commercialStatus.for-rent',
  sold: 'commercialStatus.sold',
  reserved: 'commercialStatus.reserved',
  rented: 'commercialStatus.rented',
  'under-negotiation': 'commercialStatus.under-negotiation',
  unavailable: 'commercialStatus.unavailable',
};

export const UNIT_STATUSES_FOR_FILTER = [
  'for-sale', 'for-rent', 'sold', 'reserved', 'rented', 'under-negotiation', 'unavailable',
] as const;

/** ADR-197: Commercial statuses allowed at creation (reserved/sold via sales flow) */
export const CREATION_COMMERCIAL_OPTION_KEYS: { value: CommercialStatus; labelKey: string }[] = [
  { value: 'unavailable', labelKey: 'commercialStatus.unavailable' },
  { value: 'for-sale', labelKey: 'commercialStatus.for-sale' },
  { value: 'for-rent', labelKey: 'commercialStatus.for-rent' },
];

export const OPERATIONAL_STATUS_OPTION_KEYS: { value: OperationalStatus; labelKey: string }[] = [
  { value: 'draft', labelKey: 'operationalStatus.draft' },
  { value: 'under-construction', labelKey: 'operationalStatus.under-construction' },
  { value: 'ready', labelKey: 'operationalStatus.ready' },
  { value: 'inspection', labelKey: 'operationalStatus.inspection' },
  { value: 'maintenance', labelKey: 'operationalStatus.maintenance' },
];

// ============================================================================
// HELPERS
// ============================================================================

/** Resolve a unit type to its translated label */
export function getPropertyTypeLabel(type: string, t: TFunction): string {
  const key = UNIT_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

/** Resolve a commercial status to its translated label */
export function getPropertyStatusLabel(status: string, t: TFunction): string {
  const key = UNIT_STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
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
