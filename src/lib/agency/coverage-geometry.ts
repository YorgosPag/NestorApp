/**
 * @fileoverview **Η ΔΗΛΩΜΕΝΗ ΕΜΒΕΛΕΙΑ ΩΣ ΣΧΗΜΑ ΣΤΟΝ ΧΑΡΤΗ** — ο ΕΝΑΣ μεταφραστής
 * `DeclaredCoverage → γεωμετρία` για τον κατάλογο επαγγελματιών (ADR-896).
 * @related ADR-846 (δηλωμένη εμβέλεια) · ADR-883 (όρια διοικητικών περιοχών) · types/agency-coverage
 * @module lib/agency/coverage-geometry
 *
 * 🏆 **ΤΟ ΠΡΟΤΥΠΟ: Google Business Profile, service-area business.** Όποιος δεν δέχεται πελάτες
 * στην έδρα του **δεν** έχει πινέζα· ο χάρτης δείχνει **σχήμα που καλύπτει τις περιοχές
 * εξυπηρέτησης**. Εδώ ζει η μετάφραση της δήλωσης σε εκείνο το σχήμα.
 *
 * 🔑 **ΤΕΣΣΕΡΑ ΣΚΕΛΗ ΔΗΛΩΣΗΣ, ΤΕΣΣΕΡΙΣ ΑΠΑΝΤΗΣΕΙΣ — ΚΑΜΙΑ ΜΑΝΤΕΨΙΑ:**
 * | δήλωση | σχήμα | γιατί |
 * |---|---|---|
 * | `null` | `none` | *«δεν δήλωσε»* ≠ *«δουλεύει παντού»* — το «δεν ξέρω» λέγεται (ADR-846) |
 * | `nationwide` | `nationwide` | ολόκληρη η χώρα βαμμένη θα ήταν θόρυβος, όχι πληροφορία — λέγεται με λέξεις |
 * | κύκλος / περίγραμμα | `drawn` | η γεωμετρία είναι **ήδη** στη δήλωση |
 * | `adminIds` | `admin` | τα **πραγματικά** όρια φορτώνονται τεμπέλικα (ADR-883) — εδώ μόνο οι ταυτότητες |
 *
 * ⛔ **Ποτέ κύκλος ακτίνας γύρω από την ΕΔΡΑ** (`agency-profile.ts` #6): η ακτίνα έχει **δικό της**
 * κέντρο, που όρισε ο άνθρωπος. Ένας κύκλος καρφωμένος στην έδρα θα ήταν μαντεψιά για λογαριασμό του.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React, δίκτυο ή δίσκο.
 */

import { METRES_PER_KM } from '@/lib/geo/geo-distance';
import { geoJsonRings, outlineToGeoJson } from '@/lib/geo/geo-geojson';
import { geoCircleOutline, geoRingsBoundingBox } from '@/lib/geo/geo-ring';
import {
  isNationwide,
  isOutlineCoverage,
  isRadiusCoverage,
  type DeclaredCoverage,
} from '@/types/agency-coverage';
import type { GeoBoundingBox, GeoOutline, GeoPoint } from '@/types/geo/coordinates';

export type CoverageShape =
  | { readonly kind: 'none' }
  | { readonly kind: 'nationwide' }
  | { readonly kind: 'drawn'; readonly geometry: GeoJSON.MultiPolygon }
  | { readonly kind: 'admin'; readonly adminIds: readonly string[] };

/**
 * Δακτύλιοι → **ένα** `MultiPolygon`, ένα μέρος ανά δακτύλιο — μέσω του **ενός** `outlineToGeoJson`.
 * ⚠️ Δακτύλιος με < 3 κορυφές **δεν** μπαίνει: δεν περικλείει εμβαδόν, άρα δεν είναι σχήμα.
 */
export function outlinesToMultiPolygon(outlines: readonly GeoOutline[]): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: outlines
      .filter((outline) => outline.length >= 3)
      .map((outline) => outlineToGeoJson(outline).geometry.coordinates),
  };
}

/**
 * Πολλά `MultiPolygon` → ένα, με **παράθεση** των μερών (χωρίς διάλυση κοινών ορίων).
 * 🔑 Αρκεί για απεικόνιση: γειτονικοί δήμοι δεν επικαλύπτονται, άρα το ημιδιαφανές γέμισμα δεν
 * «διπλοβάφεται»· η εσωτερική γραμμή δείχνει μάλιστα **από ποιες** περιοχές αποτελείται η δήλωση.
 */
export function mergeMultiPolygons(parts: readonly GeoJSON.MultiPolygon[]): GeoJSON.MultiPolygon {
  return { type: 'MultiPolygon', coordinates: parts.flatMap((part) => part.coordinates) };
}

/** **Η ΔΗΛΩΣΗ → ΣΧΗΜΑ.** Δες τον πίνακα στην επικεφαλίδα. */
export function coverageShape(coverage: DeclaredCoverage | null): CoverageShape {
  if (coverage === null) return { kind: 'none' };
  if (isNationwide(coverage)) return { kind: 'nationwide' };
  if (isRadiusCoverage(coverage)) {
    const { center, radiusKm } = coverage.circle;
    const outline = geoCircleOutline(center, radiusKm * METRES_PER_KM);
    return outline === null ? { kind: 'none' } : { kind: 'drawn', geometry: outlinesToMultiPolygon([outline]) };
  }
  if (isOutlineCoverage(coverage)) {
    return { kind: 'drawn', geometry: outlinesToMultiPolygon([coverage.outline]) };
  }
  return coverage.adminIds.length === 0 ? { kind: 'none' } : { kind: 'admin', adminIds: coverage.adminIds };
}

/**
 * Το κάδρο της κάμερας για ένα σχήμα — και, προαιρετικά, για σημεία που πρέπει να φαίνονται **μαζί**
 * του (οι πινέζες του ίδιου γραφείου). `null` = τίποτα να καδραριστεί.
 */
export function multiPolygonExtent(
  geometry: GeoJSON.MultiPolygon,
  alsoInclude: readonly GeoPoint[] = [],
): GeoBoundingBox | null {
  return geoRingsBoundingBox([...geoJsonRings(geometry), alsoInclude]);
}
