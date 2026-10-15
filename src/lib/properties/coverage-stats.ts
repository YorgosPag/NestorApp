/**
 * @fileoverview **Πληρότητα τεκμηρίωσης** (φωτογραφίες · κατόψεις · έγγραφα) ενός συνόλου ακινήτων.
 * @module lib/properties/coverage-stats
 * @see hooks/usePropertiesStats (αναφορές) · hooks/usePropertyFilters (η οθόνη ακινήτων) · ADR-840 Σ3
 *
 * Ως το Σ3 ο ίδιος υπολογισμός ζούσε **δύο φορές** (`usePropertiesStats` + `usePropertiesViewerState`). Τώρα ζει εδώ,
 * και η οθόνη ακινήτων τον καλεί πάνω στο **φιλτραρισμένο** σύνολο: η κάρτα κάλυψης μετρά ό,τι βλέπεις.
 *
 * ⚠️ Ακίνητο χωρίς `propertyCoverage` μετρά ως «λείπει» — ίδια σύμβαση με το φίλτρο `?missing=`.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import { countBy, rate } from '@/utils/collection-utils';

export interface CoverageInput {
  propertyCoverage?: { hasPhotos?: boolean; hasFloorplans?: boolean; hasDocuments?: boolean };
}

/** Property documentation coverage stats — η κάρτα «Πληρότητα». */
export interface CoverageStats {
  totalProperties: number;
  propertiesWithPhotos: number;
  propertiesWithFloorplans: number;
  propertiesWithDocuments: number;
  photosPercentage: number;
  floorplansPercentage: number;
  documentsPercentage: number;
}

export function computeCoverageStats(properties: CoverageInput[]): CoverageStats {
  const total = properties.length;
  const propertiesWithPhotos = countBy(properties, (p) => p.propertyCoverage?.hasPhotos === true);
  const propertiesWithFloorplans = countBy(properties, (p) => p.propertyCoverage?.hasFloorplans === true);
  const propertiesWithDocuments = countBy(properties, (p) => p.propertyCoverage?.hasDocuments === true);
  return {
    totalProperties: total,
    propertiesWithPhotos,
    propertiesWithFloorplans,
    propertiesWithDocuments,
    photosPercentage: rate(propertiesWithPhotos, total),
    floorplansPercentage: rate(propertiesWithFloorplans, total),
    documentsPercentage: rate(propertiesWithDocuments, total),
  };
}
