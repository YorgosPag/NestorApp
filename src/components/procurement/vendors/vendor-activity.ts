/**
 * Η «δραστηριότητα» ενός προμηθευτή — ο ΕΝΑΣ ορισμός του «ενεργός» στη λίστα προμηθευτών (ADR-330 §5.1 S3.4).
 *
 * «Ενεργός» = έχει τουλάχιστον μία **μη ακυρωμένη** παραγγελία. Είναι το ίδιο κριτήριο με το
 * `activeSuppliersCount` του ταμπλό του hub (`useProcurementDashboard`: προμηθευτές παραγγελιών εκτός
 * `cancelled`) και με το `totalOrders` του `supplier-metrics-service` (μη ακυρωμένες). Το εξαντλητικό
 * `Record` είναι το λεξιλόγιο του `?status=` της λίστας (`useStatusDrillParam`).
 *
 * @module components/procurement/vendors/vendor-activity
 */

import type { VendorCardData } from './VendorCard';

export const VENDOR_ACTIVITY_PREDICATES = {
  active: (v: Pick<VendorCardData, 'metrics'>) => (v.metrics?.totalOrders ?? 0) > 0,
} as const satisfies Record<string, (v: Pick<VendorCardData, 'metrics'>) => boolean>;

export type VendorActivity = keyof typeof VENDOR_ACTIVITY_PREDICATES;

/** Κενή λίστα ⇒ χωρίς φίλτρο ⇒ ναι. */
export function matchesVendorActivity(
  v: Pick<VendorCardData, 'metrics'>, filters: readonly VendorActivity[],
): boolean {
  return filters.length === 0 || filters.some((f) => VENDOR_ACTIVITY_PREDICATES[f](v));
}
