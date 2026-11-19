/**
 * @fileoverview **ΘΡΑΥΣΜΑΤΑ → ΚΤΙΡΙΟ** — η ραφή των κομματιών ενός κτιρίου του αρχείου και τα γεγονότα που βγαίνουν από αυτό.
 * @related ADR-777 · SPEC-777A §13.3 (περιεκτικότητα, όχι εγγύτητα) · §13.4 (ODbL) · ./osm-archive-tile · ./osm-building
 * @module lib/geo/osm/osm-archive-building
 *
 * 🔑 **Ίδια σημασία με την απάντηση του Overpass, για να είναι οι δύο πηγές εναλλάξιμες**:
 *    - σημείο = **κέντρο του περιβλήματος** — ό,τι δίνει το `out center` του Overpass (όχι κέντρο βάρους)·
 *    - περίγραμμα = ο **εξωτερικός δακτύλιος** χωρίς επανάληψη της πρώτης κορυφής (σύμβαση `GeoOutline`)·
 *    - επιλογή = **περιεκτικότητα**, και όταν περιέχουν πολλά νικά το **μικρότερο** (`findOsmBuildingAt`, §13.3).
 *
 * 🔑 **Η ένωση είναι η πρακτική της ίδιας της Mapbox**: κομμένα στοιχεία με το ίδιο `id` ενώνονται (`turf.union`, που
 *    στην έκδοση 6 είναι ακριβώς το `polygon-clipping`). Γίνεται στο **ακέραιο πλέγμα** (δες `osm-archive-tile`). Αστοχία
 *    της βιβλιοθήκης ⇒ `null` («δεν ξέρω»), **ποτέ** εξαίρεση προς τα πάνω και **ποτέ** ένα θραύσμα ως «το κτίριο».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από δίκτυο/Firestore/React.
 */

import polygonClipping from 'polygon-clipping';

import { geoOutlineAreaSqm, geoRingsBoundingBox, isPointInGeoRings } from '@/lib/geo/geo-ring';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

import { geoPointOfGrid, type BuildingFragment, type GridPair, type GridPolygon } from './osm-archive-tile';
import { osmRefOfTileFeatureId, type ProtomapsOsmRef } from './protomaps-osm-identity';

/** Ένα κτίριο του αρχείου, ραμμένο από όλα τα κομμάτια του. */
export interface ArchiveBuilding {
  readonly featureId: number;
  /** `null` = η κωδικοποίηση δεν είναι η μετρημένη (`way`) — δες `protomaps-osm-identity`. */
  readonly ref: ProtomapsOsmRef | null;
  /** Ο εξωτερικός δακτύλιος — **μόνο για να ζωγραφιστεί**, ποτέ αποθήκευση (§13.4). */
  readonly outline: GeoOutline;
  readonly areaSqm: number;
  /** Το κέντρο του περιβλήματος (`out center`). */
  readonly point: GeoPoint;
  readonly houseNumber: string | null;
}

/** Κλειστός δακτύλιος πλέγματος → `GeoOutline` (χωρίς την επανάληψη της πρώτης κορυφής). */
function outlineOfRing(ring: readonly GridPair[], z: number): GeoOutline {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const open = ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
  return open.map((pair) => geoPointOfGrid(pair, z));
}

/** Η ένωση των κομματιών· `null` αν η βιβλιοθήκη αστοχήσει ή δεν μείνει τίποτα. */
function unionOf(polygons: readonly GridPolygon[]): GridPolygon[] | null {
  if (polygons.length === 1) return [polygons[0]];
  try {
    const [first, ...rest] = polygons;
    const merged = polygonClipping.union(first, ...rest);
    return merged.length > 0 ? merged : null;
  } catch {
    return null;
  }
}

/**
 * **Όλα τα θραύσματα ενός κτιρίου → το κτίριο.**
 *
 * ⚠️ Αν η ένωση δώσει **πολλά** ξένα πολύγωνα (π.χ. ένα `building_part` που το OSM έχει σε δύο νησίδες) κρατιέται το
 *    **μεγαλύτερο** — ίδια απόφαση με τον Overpass, που για ένα `way` δίνει **έναν** δακτύλιο.
 * @param fragments Θραύσματα **του ίδιου** `featureId` (ο καλών ομαδοποιεί).
 */
export function assembleArchiveBuilding(fragments: readonly BuildingFragment[], z: number): ArchiveBuilding | null {
  const head = fragments[0];
  if (head === undefined) return null;
  const merged = unionOf(fragments.flatMap((fragment) => fragment.polygons));
  if (merged === null) return null;

  const outlines = merged
    .map((polygon) => outlineOfRing(polygon[0], z))
    .filter((outline) => outline.length >= 3)
    .map((outline) => ({ outline, areaSqm: geoOutlineAreaSqm(outline) }))
    .sort((a, b) => b.areaSqm - a.areaSqm);
  const largest = outlines[0];
  if (largest === undefined) return null;

  const box = geoRingsBoundingBox([largest.outline]);
  if (box === null) return null;
  return {
    featureId: head.featureId,
    ref: osmRefOfTileFeatureId(head.featureId),
    outline: largest.outline,
    areaSqm: largest.areaSqm,
    point: { lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2 },
    houseNumber: fragments.find((fragment) => fragment.houseNumber !== null)?.houseNumber ?? null,
  };
}

/**
 * **Περιέχει αυτό το θραύσμα το σημείο;** — even–odd σε όλους τους δακτυλίους (οι τρύπες ακυρώνουν τον εξωτερικό).
 * Το σημείο πέφτει στο πλακίδιο του θραύσματος, άρα το κομμάτι αρκεί: έξω από το κομμάτι = έξω από το κτίριο **εκεί**.
 */
export function fragmentContains(fragment: BuildingFragment, point: GeoPoint, z: number): boolean {
  const rings = fragment.polygons.flatMap((polygon) => polygon.map((ring) => outlineOfRing(ring, z)));
  return isPointInGeoRings(point, rings);
}

/** Ομαδοποίηση θραυσμάτων ανά `featureId` — η μόνη σωστή σειρά πριν από τη ραφή. */
export function fragmentsById(fragments: readonly BuildingFragment[]): Map<number, BuildingFragment[]> {
  const byId = new Map<number, BuildingFragment[]>();
  for (const fragment of fragments) {
    const group = byId.get(fragment.featureId);
    if (group === undefined) byId.set(fragment.featureId, [fragment]);
    else group.push(fragment);
  }
  return byId;
}
