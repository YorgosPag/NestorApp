/**
 * @fileoverview **ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΣ ΑΠΟ ΤΟΝ ΧΑΡΤΗ** — περίγραμμα κτιρίου (lng/lat) + οι πλευρές που επέλεξε ο άνθρωπος ⇒ οι
 * όψεις του ακινήτου στο λεξιλόγιο.
 * @related ADR-937 Φάση Γ · lib/geo/geo-local-frame (προβολή σε μέτρα) · lib/geometry/polygon-azimuth (εξωτερική κάθετος) ·
 *   lib/geometry/azimuth-orientation (αζιμούθιο → προσανατολισμός) · components/properties/shared/OrientationFromMapDialog
 * @module lib/property/orientation-from-map
 *
 * 🔑 Στον χάρτη ο Βορράς είναι **αληθινός** (+Y της τοπικής προβολής = μεσημβρινός) — καμία υπόθεση, `northAssumed: false`.
 * ⚠️ Το περίγραμμα είναι δεδομένο OSM (ODbL): χρησιμοποιείται **μόνο** για να βγει μια γωνία· **δεν** αποθηκεύεται πουθενά.
 *    Αποθηκεύονται μόνο οι κατευθύνσεις που διάλεξε ο άνθρωπος.
 */

import type { Geometry, Position } from 'geojson';

import type { OrientationType } from '@/constants/property-features-enterprise';
import { toLocalMetres } from '@/lib/geo/geo-local-frame';
import { orientationOfAzimuth } from '@/lib/geometry/azimuth-orientation';
import { polygonArea } from '@/lib/geometry/planar-polygon';
import { edgeOutwardAzimuthDeg } from '@/lib/geometry/polygon-azimuth';
import { canonicalOrientations } from '@/lib/property/orientation-proposal';
import type { GeoPoint } from '@/types/geo/coordinates';

function ringOf(positions: readonly Position[]): GeoPoint[] {
  const ring = positions.map(([lng, lat]) => ({ lat, lng }));
  const first = ring[0];
  const last = ring[ring.length - 1];
  // Το GeoJSON κλείνει τον δακτύλιο επαναλαμβάνοντας την πρώτη κορυφή — εδώ κάθε ακμή πρέπει να μετρά μία φορά.
  if (ring.length > 1 && first.lat === last.lat && first.lng === last.lng) ring.pop();
  return ring;
}

/** Ο εξωτερικός δακτύλιος ενός κτιρίου (στο `MultiPolygon` ο μεγαλύτερος), ή `null` αν το σχήμα δεν είναι πολύγωνο. */
export function buildingRingOf(geometry: Geometry): GeoPoint[] | null {
  if (geometry.type === 'Polygon') {
    const ring = ringOf(geometry.coordinates[0] ?? []);
    return ring.length >= 3 ? ring : null;
  }
  if (geometry.type !== 'MultiPolygon') return null;
  let best: GeoPoint[] | null = null;
  let bestArea = 0;
  for (const polygon of geometry.coordinates) {
    const ring = ringOf(polygon[0] ?? []);
    if (ring.length < 3) continue;
    const area = polygonArea(toLocalMetres(ring, ring[0]));
    if (area > bestArea) {
      best = ring;
      bestArea = area;
    }
  }
  return best;
}

/** Ο προσανατολισμός κάθε ακμής του δακτυλίου (εξωτερική κάθετος), ή `null` για εκφυλισμένη ακμή. */
export function edgeOrientationsOf(ring: readonly GeoPoint[]): (OrientationType | null)[] {
  if (ring.length < 3) return [];
  const local = toLocalMetres(ring, ring[0]);
  return local.map((_, i) => orientationOfAzimuth(edgeOutwardAzimuthDeg(local, i)));
}

/** Οι όψεις των επιλεγμένων ακμών, στη σειρά του λεξιλογίου, χωρίς διπλότυπα. */
export function orientationsOfSelectedEdges(
  ring: readonly GeoPoint[],
  selectedEdges: ReadonlySet<number>,
): OrientationType[] {
  const perEdge = edgeOrientationsOf(ring);
  const picked = perEdge.filter((o, i): o is OrientationType => o !== null && selectedEdges.has(i));
  return canonicalOrientations(picked);
}
