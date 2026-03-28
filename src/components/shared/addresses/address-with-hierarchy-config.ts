/**
 * =============================================================================
 * address-with-hierarchy-config.ts
 * =============================================================================
 * Types, interfaces, and constants for the AddressWithHierarchy component.
 * Extracted to keep the component file under 500 lines (Google SRP).
 *
 * @module components/shared/addresses/address-with-hierarchy-config
 */

import {
  ADMIN_LEVEL_LABELS,
  type AdminPath,
  type AdminLevel,
} from '@/hooks/useAdministrativeHierarchy';

// =============================================================================
// TYPES
// =============================================================================

/** Full address value including Greek admin hierarchy */
export interface AddressWithHierarchyValue {
  // Basic fields
  street: string;
  number: string;
  postalCode: string;
  // Settlement = Oikismos / City
  settlementId: string | null;
  settlementName: string;
  // Greek administrative hierarchy (auto-filled from settlement selection)
  communityId: string | null;
  communityName: string;
  municipalUnitId: string | null;
  municipalUnitName: string;
  municipalityId: string | null;
  municipalityName: string;
  regionalUnitId: string | null;
  regionalUnitName: string;
  regionId: string | null;
  regionName: string;
  decentAdminId: string | null;
  decentAdminName: string;
  majorGeoId: string | null;
  majorGeoName: string;
}

export interface AddressWithHierarchyProps {
  value?: Partial<AddressWithHierarchyValue>;
  onChange: (value: AddressWithHierarchyValue) => void;
  disabled?: boolean;
  /** Show street + number fields. Default: true */
  showStreetFields?: boolean;
  /** Which hierarchy levels to show in collapsible section. Default: [7,6,5,4,3] */
  hierarchyLevels?: AdminLevel[];
  /** Start with hierarchy section expanded. Default: false */
  defaultExpanded?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const EMPTY_VALUE: AddressWithHierarchyValue = {
  street: '',
  number: '',
  postalCode: '',
  settlementId: null,
  settlementName: '',
  communityId: null,
  communityName: '',
  municipalUnitId: null,
  municipalUnitName: '',
  municipalityId: null,
  municipalityName: '',
  regionalUnitId: null,
  regionalUnitName: '',
  regionId: null,
  regionName: '',
  decentAdminId: null,
  decentAdminName: '',
  majorGeoId: null,
  majorGeoName: '',
};

/** Maps hierarchy path keys to value fields */
export const PATH_TO_VALUE: ReadonlyArray<{
  pathKey: keyof AdminPath;
  idField: keyof AddressWithHierarchyValue;
  nameField: keyof AddressWithHierarchyValue;
  level: AdminLevel;
}> = [
  { pathKey: 'settlement', idField: 'settlementId', nameField: 'settlementName', level: 8 },
  { pathKey: 'community', idField: 'communityId', nameField: 'communityName', level: 7 },
  { pathKey: 'municipalUnit', idField: 'municipalUnitId', nameField: 'municipalUnitName', level: 6 },
  { pathKey: 'municipality', idField: 'municipalityId', nameField: 'municipalityName', level: 5 },
  { pathKey: 'regionalUnit', idField: 'regionalUnitId', nameField: 'regionalUnitName', level: 4 },
  { pathKey: 'region', idField: 'regionId', nameField: 'regionName', level: 3 },
  { pathKey: 'decentAdmin', idField: 'decentAdminId', nameField: 'decentAdminName', level: 2 },
  { pathKey: 'majorGeo', idField: 'majorGeoId', nameField: 'majorGeoName', level: 1 },
];

/** Hierarchy fields for the collapsible section (levels 7-3, no settlement/postalCode) */
export const HIERARCHY_FIELDS: ReadonlyArray<{
  level: AdminLevel;
  idField: keyof AddressWithHierarchyValue;
  nameField: keyof AddressWithHierarchyValue;
  label: string;
  placeholderKey: string;
}> = [
  { level: 7, idField: 'communityId', nameField: 'communityName', label: ADMIN_LEVEL_LABELS[7], placeholderKey: 'form.communityPlaceholder' },
  { level: 6, idField: 'municipalUnitId', nameField: 'municipalUnitName', label: ADMIN_LEVEL_LABELS[6], placeholderKey: 'form.municipalUnitPlaceholder' },
  { level: 5, idField: 'municipalityId', nameField: 'municipalityName', label: ADMIN_LEVEL_LABELS[5], placeholderKey: 'form.municipalityPlaceholder' },
  { level: 4, idField: 'regionalUnitId', nameField: 'regionalUnitName', label: ADMIN_LEVEL_LABELS[4], placeholderKey: 'form.regionalUnitPlaceholder' },
  { level: 3, idField: 'regionId', nameField: 'regionName', label: ADMIN_LEVEL_LABELS[3], placeholderKey: 'form.regionHierarchyPlaceholder' },
];
