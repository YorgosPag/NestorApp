/**
 * ADR-449 PART B — group-by-material area accumulation (σοβάς): pure SSoT.
 *
 * Ανήκει στο **finishes** layer (λειτουργεί πάνω σε `FinishFaceSegment`) ώστε ο scene builder
 * να ΜΗΝ εισάγει value από το services layer (`structural-finish-boq`) — αποφεύγει κυκλική
 * εξάρτηση (finishes → services → …). Το BOQ service καταναλώνει μόνο τον τύπο `FinishMaterialBucket`.
 *
 * Pure: μηδέν globals/React/THREE.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { FinishFaceSegment } from './structural-finish-types';

/** ADR-449 PART B — καθαρό εμβαδό σοβά ενός distinct υλικού (m²). */
export interface FinishMaterialBucket {
  readonly materialId: string;
  readonly areaM2: number;
}

/**
 * Group-by-material πάνω σε bands/faces: αθροίζει `lengthM × heightM` ανά `materialId` (το
 * per-face `materialId` ενσωματώνει ήδη τα PART B overrides). Επιστρέφει ταξινομημένα buckets
 * θετικού εμβαδού (deterministic). Κάθε entry = μία ζώνη με το ύψος της (m)· ύψος ≤ 0 αγνοείται.
 * Το χρώμα (`colorOverride`) ΔΕΝ σπάει buckets (Giorgio: επιμέτρηση ανά υλικό, χρώμα = οπτικό).
 */
export function finishAreasByMaterial(
  bands: readonly { readonly segments: readonly FinishFaceSegment[]; readonly heightM: number }[],
): FinishMaterialBucket[] {
  const acc = new Map<string, number>();
  for (const band of bands) {
    const hM = Math.max(0, band.heightM);
    if (hM <= 0) continue;
    for (const seg of band.segments) {
      acc.set(seg.materialId, (acc.get(seg.materialId) ?? 0) + seg.lengthM * hM);
    }
  }
  return [...acc.entries()]
    .filter(([, areaM2]) => areaM2 > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([materialId, areaM2]) => ({ materialId, areaM2 }));
}
