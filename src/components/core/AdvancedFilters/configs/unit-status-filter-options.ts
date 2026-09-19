/**
 * =============================================================================
 * Οι ΕΠΙΛΟΓΕΣ φίλτρου κατάστασης μονάδων — διάθεση · λειτουργία (ADR-777 §8.60.20)
 * =============================================================================
 *
 * **Μία** δήλωση για panel (`AdvancedFiltersPanel`) **και** toolbar (`CompactToolbar`), για
 * ακίνητα **και** χώρους. Ήταν χειρόγραφες λίστες σε κάθε config — και οι λίστες των χώρων ήταν
 * χτισμένες πάνω στο παλιό ανάμεικτο `status` («Κατειλημμένη» δίπλα στο «Πωλημένη»).
 *
 * Οι ετικέτες ακολουθούν τη σύμβαση του `translateFilterLabel`: `filters.<κλειδί>` (γνωστό
 * namespace με τελεία) και `properties-enums:<κλειδί>` (ρητό namespace i18next) — **τα ίδια**
 * κλειδιά με τον επιλογέα της φόρμας.
 *
 * @module components/core/AdvancedFilters/configs/unit-status-filter-options
 */

import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import { COMMON_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
import { SPACE_AVAILABILITY_BUCKETS } from '@/lib/spaces/space-availability';
import type { FilterFieldConfig, FilterOption } from '../types';

/** Διάθεση χώρου — οι κουβάδες του `commercialStatus` (χωρίς το «όλοι»). */
export const SPACE_AVAILABILITY_FILTER_OPTIONS: readonly FilterOption[] = SPACE_AVAILABILITY_BUCKETS.map(
  (bucket) => ({ value: bucket, label: `filters.spaceAvailability.${bucket}` }),
);

/** Λειτουργική κατάσταση — ίδιο λεξιλόγιο και ίδιες ετικέτες για ακίνητα και χώρους. */
export const OPERATIONAL_STATUS_FILTER_OPTIONS: readonly FilterOption[] = OPERATIONAL_STATUSES.map(
  (status) => ({ value: status, label: `properties-enums:operationalStatus.${status}` }),
);

/** Η επιλογή «όλες» ενός select του panel — ίδια σε κάθε όψη κατάστασης. */
const ALL_STATUSES_OPTION: FilterOption = { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES };

/**
 * Οι **δύο** όψεις κατάστασης ενός χώρου στο panel — «Διάθεση» (από το `commercialStatus`) και
 * «Λειτουργία» — για θέσεις **και** αποθήκες. Ήταν γραμμένες δύο φορές (μία ανά config), δηλαδή
 * δίδυμα που το `jscpd:diff` (CHECK 3.28) έπιασε αμέσως.
 *
 * @param statusAriaLabel — το κλειδί προσβασιμότητας του χώρου για την όψη διάθεσης
 */
export function spaceStatusFilterFields(statusAriaLabel: string): FilterFieldConfig[] {
  return [
    {
      id: 'status',
      type: 'select',
      label: 'properties-enums:unitStatus.availability',
      placeholder: 'filters.common.selectStatus',
      ariaLabel: statusAriaLabel,
      width: 1,
      options: [ALL_STATUSES_OPTION, ...SPACE_AVAILABILITY_FILTER_OPTIONS],
    },
    {
      id: 'operationalStatus',
      type: 'select',
      label: 'properties-enums:unitStatus.operational',
      placeholder: 'filters.common.selectStatus',
      ariaLabel: 'properties-enums:unitStatus.operational',
      width: 1,
      options: [ALL_STATUSES_OPTION, ...OPERATIONAL_STATUS_FILTER_OPTIONS],
    },
  ];
}
