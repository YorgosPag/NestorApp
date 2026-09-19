/**
 * Οι πίτες ΚΑΤΑΣΤΑΣΗΣ ενός είδους χώρου (θέσεις · αποθήκες) — διάθεση + λειτουργία (ADR-777 §8.60.20)
 *
 * **Ένα** σημείο για τα δύο διαγράμματα χώρων. Ως τις 2026-09-18 καθένα είχε δικό του λεξιλόγιο
 * πάνω στο παλιό ανάμεικτο `status` («διαθέσιμη / κατειλημμένη / συντήρηση / πωλημένη» σε μία
 * πίτα). Τώρα δύο πίτες, δύο ερωτήματα: **διάθεση** (οι ετικέτες της πίτας μονάδων έργου —
 * `projects.unitStatus.statuses`, ίδιο λεξιλόγιο) και **λειτουργία**.
 *
 * @module components/reports/sections/spaces/space-status-pies
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import { UNDECLARED_STATUS_KEY } from '@/lib/spaces/space-availability';
import { buildCategoryPie, type ReportCategorySlice } from '@/components/reports/core';

type Translate = Parameters<typeof buildCategoryPie>[0];

const OPERATIONAL_PIE_KEYS = [...OPERATIONAL_STATUSES, UNDECLARED_STATUS_KEY] as const;

export interface SpaceStatusPieData {
  readonly commercialData: ReportCategorySlice[];
  readonly operationalData: ReportCategorySlice[];
}

/** Οι δύο πίτες κατάστασης, με τη σειρά που εμφανίζονται. */
export function buildSpaceStatusPies(t: Translate, data: SpaceStatusPieData) {
  return [
    buildCategoryPie(t, {
      data: data.commercialData,
      labelKey: 'chart.category.availability',
      keys: COMMERCIAL_STATUSES,
      keyPrefix: 'projects.unitStatus.statuses',
    }),
    buildCategoryPie(t, {
      data: data.operationalData,
      labelKey: 'chart.category.operational',
      keys: OPERATIONAL_PIE_KEYS,
      keyPrefix: 'spaces.operationalStatuses',
    }),
  ];
}

/** Έχει δεδομένα κάποια από τις δύο πίτες; */
export function hasSpaceStatusData(data: SpaceStatusPieData): boolean {
  return data.commercialData.length > 0 || data.operationalData.length > 0;
}
