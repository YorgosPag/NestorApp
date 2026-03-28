/**
 * =============================================================================
 * Location Converters — ProjectAddress ↔ AddressWithHierarchyValue
 * =============================================================================
 *
 * @module components/projects/tabs/locations/location-converters
 * @enterprise ADR-167
 */

import type { ProjectAddress } from '@/types/project/addresses';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';

/** Default hierarchy value (all fields empty/null) */
export const EMPTY_HIERARCHY: AddressWithHierarchyValue = {
  street: '',
  number: '',
  postalCode: '',
  settlementName: '',
  settlementId: null,
  communityName: '',
  communityId: null,
  municipalUnitName: '',
  municipalUnitId: null,
  municipalityName: '',
  municipalityId: null,
  regionalUnitName: '',
  regionalUnitId: null,
  regionName: '',
  regionId: null,
  decentAdminName: '',
  decentAdminId: null,
  majorGeoName: '',
  majorGeoId: null,
};

/** Convert ProjectAddress → AddressWithHierarchyValue for the centralized component */
export function toHierarchyValue(addr: Partial<ProjectAddress>): Partial<AddressWithHierarchyValue> {
  return {
    street: addr.street ?? '',
    number: addr.number ?? '',
    postalCode: addr.postalCode ?? '',
    settlementName: addr.city ?? '',
    settlementId: null,
    communityName: addr.neighborhood ?? '',
    municipalUnitName: '',
    municipalityName: addr.municipality ?? '',
    municipalityId: null,
    regionalUnitName: addr.regionalUnit ?? '',
    regionName: addr.region ?? '',
    decentAdminName: '',
    majorGeoName: '',
  };
}

/** Convert AddressWithHierarchyValue → partial ProjectAddress fields */
export function fromHierarchyValue(val: AddressWithHierarchyValue): Partial<ProjectAddress> {
  return {
    street: val.street || '',
    city: val.settlementName || val.municipalityName || '',
    postalCode: val.postalCode || '',
    ...(val.number ? { number: val.number } : {}),
    ...(val.communityName ? { neighborhood: val.communityName } : {}),
    ...(val.municipalityName ? { municipality: val.municipalityName } : {}),
    ...(val.regionalUnitName ? { regionalUnit: val.regionalUnitName } : {}),
    ...(val.regionName ? { region: val.regionName } : {}),
  };
}
