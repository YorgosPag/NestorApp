/**
 * @fileoverview **Πού γράφεται η ετικέτα μιας γεωγραφικής περιοχής** — ο πόλος απροσπέλαστου του **μεγαλύτερου**
 * πολυγώνου ενός MultiPolygon, σε **μέτρα** (όχι μοίρες), επιστρεμμένος ως `[lon, lat]` (ADR-890 §15).
 * @related `lib/geometry/polygon-label-point.ts` (ο αλγόριθμος, SSoT) · `geo-local-frame.ts` (η προβολή, SSoT)
 * @module scripts/lib/admin-overview/geo-label-point
 *
 * 🔑 **Γιατί σε μέτρα**: στις 40° η μοίρα μήκους είναι ~0,77 της μοίρας πλάτους· το polylabel σε μοίρες θα
 *    «νόμιζε» ότι ένας στενός βορειονότιος Δήμος είναι φαρδύς, και η ετικέτα θα άγγιζε το σύνορο.
 * 🔑 **Γιατί το μεγαλύτερο πολύγωνο**: μια Δ.Ε. με νησίδες έχει ΜΙΑ ετικέτα, στο κύριο σώμα της.
 * ⚠️ Οι **τρύπες** αγνοούνται (ο αλγόριθμος δέχεται έναν δακτύλιο): Δ.Ε. με θύλακα άλλης Δ.Ε. είναι σπάνια, και ο
 *    θύλακας σχεδιάζεται πάνω της με τη δική του ετικέτα.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

import { polygonArea } from '@/lib/geometry/planar-polygon';
import { polygonLabelPoint } from '@/lib/geometry/polygon-label-point';
import { fromLocalMetres, toLocalMetres } from '@/lib/geo/geo-local-frame';

/** Αρκεί ακρίβεια 25 m: η ετικέτα είναι κείμενο δεκάδων pixel, όχι σημείο μέτρησης. */
const LABEL_PRECISION_M = 25;
/** 5 δεκαδικά ≈ 1 m — ντετερμινιστική έξοδος για τον γεννήτορα (ίδιο sha256 σε κάθε εκτέλεση). */
const LABEL_DECIMALS = 5;

function round(value: number): number {
  const scale = 10 ** LABEL_DECIMALS;
  return Math.round(value * scale) / scale;
}

/** Ο εξωτερικός δακτύλιος χωρίς την επανάληψη της πρώτης κορυφής (RFC 7946 τον κλείνει). */
function openRing(ring: readonly GeoJSON.Position[]): GeoPoint[] {
  const points = ring.map(([lng, lat]) => ({ lat, lng }));
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first.lat === last.lat && first.lng === last.lng) points.pop();
  return points;
}

/**
 * Το σημείο ετικέτας ενός MultiPolygon ως `[lon, lat]`, ή `null` για άδεια γεωμετρία. Κάθε πολύγωνο προβάλλεται
 * στο **δικό του** τοπικό πλαίσιο (ισορθογώνια γύρω από την πρώτη κορυφή) — τα εμβαδά είναι συγκρίσιμα σε μέτρα.
 */
export function geoLabelPoint(geometry: GeoJSON.MultiPolygon): readonly [lon: number, lat: number] | null {
  let best: { readonly area: number; readonly ring: readonly GeoPoint[] } | null = null;
  for (const polygon of geometry.coordinates) {
    const ring = openRing(polygon[0] ?? []);
    if (ring.length < 3) continue;
    const area = polygonArea(toLocalMetres(ring, ring[0]));
    if (best === null || area > best.area) best = { area, ring };
  }
  if (best === null) return null;
  const origin = best.ring[0];
  const { point } = polygonLabelPoint(toLocalMetres(best.ring, origin), LABEL_PRECISION_M);
  const { lat, lng } = fromLocalMetres(point, origin);
  return [round(lng), round(lat)];
}
