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
  country: '',
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
    country: addr.country ?? '',
    settlementName: addr.city ?? '',
    settlementId: null,
    communityName: addr.neighborhood ?? '',
    // ADR-759 Φ3 — ήταν σταθερά `''`: ο επιλογέας Δημοτικής Ενότητας (επίπεδο 6) ζωγραφιζόταν
    // κανονικά, ο χρήστης τον συμπλήρωνε, και η τιμή **δεν επέστρεφε ποτέ** στην επεξεργασία.
    municipalUnitName: addr.municipalUnit ?? '',
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
    // 🔴 ADR-759 Φ3 — ΕΛΕΙΠΕ. Το `municipalUnitName` δεν χαρτογραφούνταν πουθενά, άρα η
    // επιλογή του χρήστη **σβηνόταν στην αποθήκευση χωρίς μήνυμα**. Η άλλη μισή διαρροή
    // (το Zod που πετούσε το πεδίο) ζει στο `project/address-schemas.ts` — χρειάζονταν **και
    // τα δύο**: μία μόνη διόρθωση θα άφηνε τη ροή σπασμένη και θα φαινόταν διορθωμένη.
    ...(val.municipalUnitName ? { municipalUnit: val.municipalUnitName } : {}),
    ...(val.municipalityName ? { municipality: val.municipalityName } : {}),
    ...(val.regionalUnitName ? { regionalUnit: val.regionalUnitName } : {}),
    ...(val.regionName ? { region: val.regionName } : {}),
  };
}
