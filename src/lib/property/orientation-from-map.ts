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
import {
  distanceToRing,
  distanceToSegment,
  pointInPolygon,
  polygonArea,
  type PlanarPoint,
} from '@/lib/geometry/planar-polygon';
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

/**
 * **Η ανοχή του κλικ σε πλευρά**, σε pixel οθόνης. Μια γραμμή 4px δεν είναι στόχος για δάχτυλο ή για ποντίκι σε
 * αγκώνα: το Figma, το ArchiCAD και το Revit διαλέγουν γραμμή σε **απόσταση** από αυτήν, όχι μόνο πάνω της.
 * Η τιμή είναι η ακτίνα που συνήθως χρησιμοποιούν οι επιλογείς γραμμών στα σχεδιαστικά προγράμματα (~8–12px).
 */
export const EDGE_PICK_TOLERANCE_PX = 12;

/** Πόσο μακριά από τη θέση ψάχνουμε κτίριο για να το **προτείνουμε** (pixel οθόνης στο ζουμ του διαλόγου). */
export const BUILDING_SUGGEST_RADIUS_PX = 80;

/**
 * Η πλευρά του δακτυλίου (σε pixel οθόνης) που βρίσκεται **πιο κοντά** στο σημείο, μέσα στην ανοχή — αλλιώς `null`.
 * Ο δακτύλιος είναι κλειστός χωρίς επανάληψη της πρώτης κορυφής: η ακμή `i` πάει από την κορυφή `i` στην `i + 1`.
 */
export function nearestEdgeIndex(
  screenRing: readonly PlanarPoint[],
  point: PlanarPoint,
  tolerancePx: number = EDGE_PICK_TOLERANCE_PX,
): number | null {
  const n = screenRing.length;
  if (n < 2) return null;
  let best: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const distance = distanceToSegment(point, screenRing[i], screenRing[(i + 1) % n]);
    if (distance <= tolerancePx && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * **Ποιο κτίριο προτείνουμε για τη θέση;** — δείκτης στους δακτυλίους (σε pixel οθόνης) ή `null`.
 *
 * 1. Κτίριο που **περιέχει** τη θέση — αν είναι πολλά (κτίριο + τμήμα του), το **μεγαλύτερο**, γιατί οι όψεις είναι
 *    του εξωτερικού περιγράμματος.
 * 2. Αλλιώς το κτίριο με το **πλησιέστερο σύνορο**, μέσα στην ακτίνα. Η θέση της διεύθυνσης πέφτει συχνά στο
 *    πεζοδρόμιο ή στην πλατεία μπροστά από το κτίριο.
 *
 * 🔑 Είναι **πρόταση**, όχι απόφαση: ο άνθρωπος βλέπει το κτίριο τονισμένο και μπορεί να διαλέξει άλλο.
 */
export function suggestedBuildingIndex(
  screenRings: readonly (readonly PlanarPoint[])[],
  point: PlanarPoint,
  radiusPx: number = BUILDING_SUGGEST_RADIUS_PX,
): number | null {
  let containing: number | null = null;
  let containingArea = 0;
  let nearest: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < screenRings.length; i++) {
    const ring = screenRings[i];
    if (ring.length < 3) continue;
    if (pointInPolygon(point, ring)) {
      const area = polygonArea(ring);
      if (containing === null || area > containingArea) {
        containing = i;
        containingArea = area;
      }
      continue;
    }
    const distance = distanceToRing(point, ring);
    if (distance <= radiusPx && distance < nearestDistance) {
      nearest = i;
      nearestDistance = distance;
    }
  }
  return containing ?? nearest;
}
