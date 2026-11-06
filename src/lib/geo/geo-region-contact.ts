/**
 * @fileoverview **ΑΓΓΙΖΕΙ ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΤΟ ΔΙΟΙΚΗΤΙΚΟ ΟΡΙΟ;** — πολύγωνο προς πολύγωνο (ADR-923 Ν11 ε).
 * @related `geo-area.ts` (κύκλος/ορθογώνιο προς όριο) · `geo-ring.ts` (οι πράξεις δακτυλίων) · ADR-883 (τα όρια)
 * @module lib/geo/geo-region-contact
 *
 * 🔑 **Επαφή = ένα κοινό σημείο ΠΕΡΑ από την ανοχή.** Το όριο είναι απλοποιημένο με εγγυημένη απόκλιση `toleranceM` από το
 *    αληθινό σύνορο. Ένα σημείο του ενός σχήματος που απέχει περισσότερο από την ανοχή από το σύνορο του άλλου, και είναι
 *    μέσα του, είναι μέσα και στο αληθινό σχήμα. Άρα κάθε `true` είναι **απόδειξη**, ποτέ «ίσως».
 * 🔑 **Δύο κατευθύνσεις, όχι τομές ακμών.** Κορυφή του περιγράμματος μέσα στο όριο πιάνει το «περίγραμμα μέσα στον δήμο»·
 *    κορυφή του ορίου μέσα στο περίγραμμα πιάνει το «δήμος μέσα στο περίγραμμα» και κάθε σύνορο που μπαίνει στο περίγραμμα.
 *    Τα όρια έχουν πυκνές κορυφές, άρα μένει έξω μόνο λωρίδα στενότερη από την απόσταση δύο κορυφών.
 * ⚠️ **Το σφάλμα είναι πάντα προς τα κάτω.** Μια χαμένη λωρίδα σημαίνει μια περιοχή λιγότερη στη δημόσια δήλωση, ποτέ μια
 *    περιοχή που δεν εξυπηρετείται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { GeoOutline, GeoPoint, GeoRegion } from '@/types/geo/coordinates';
import { areasOverlap } from './geo-area';
import { geoRingsBoundingBox, geoRingsNearestEdgeMetres, isPointInGeoRings } from './geo-ring';

/** Μέσα στο σχήμα **και** μακρύτερα από `marginM` από το σύνορό του. */
function isDeepInside(point: GeoPoint, rings: readonly GeoOutline[], marginM: number): boolean {
  return isPointInGeoRings(point, rings) && geoRingsNearestEdgeMetres(point, rings) > marginM;
}

/**
 * `true` μόνο όταν το απλό περίγραμμα και το όριο έχουν αποδεδειγμένα κοινό σημείο. Περίγραμμα με λιγότερες από 3 κορυφές
 * δεν περικλείει τίποτα και δεν αγγίζει τίποτα.
 */
export function outlineTouchesRegion(outline: GeoOutline, region: GeoRegion): boolean {
  if (outline.length < 3) return false;
  const box = geoRingsBoundingBox([outline]);
  if (box === null || !areasOverlap(box, region.bbox)) return false;

  const { rings, toleranceM } = region;
  if (outline.some((point) => isDeepInside(point, rings, toleranceM))) return true;
  return rings.some((ring) => ring.some((point) => isDeepInside(point, [outline], toleranceM)));
}
