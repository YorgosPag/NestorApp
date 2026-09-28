/**
 * @fileoverview **Από σχήμα καννάβου σε GeoJSON του χάρτη** — δακτύλιοι → πολύγωνα με τρύπες, προβολή WGS84,
 * απλοποίηση με εγγυημένη απόκλιση, εσωτερικό σημείο.
 * @related ADR-889 §10 · `lib/geo/greek-grid.ts` (η ΜΙΑ προβολή) · `lib/geo/geo-simplify.ts` (η ΜΙΑ απλοποίηση)
 *
 * 🔑 **Ποιος δακτύλιος είναι τρύπα το λέει η ΦΟΡΑ** (ESRI): εξωτερικοί **δεξιόστροφα**, τρύπες αριστερόστροφα. Η τρύπα
 * ανατίθεται στον εξωτερικό που την περιέχει. Το GeoJSON (RFC 7946 §3.1.6) θέλει το **αντίθετο και στα δύο** ⇒
 * αντιστρέφονται **όλοι** οι δακτύλιοι.
 * Η προβολή TM είναι σύμμορφη χωρίς κατοπτρισμό, άρα η φορά επιβιώνει της μετατροπής.
 *
 * 🔑 **Το εσωτερικό σημείο κρίνεται στον ΚΑΝΝΑΒΟ** (μέτρα, επίπεδο): σάρωση οριζόντιας γραμμής στο μέσο του bbox, και
 * το μέσο του **φαρδύτερου** εσωτερικού διαστήματος. Το κεντροειδές κορυφών πέφτει έξω σε κοίλες ζώνες (Γ, Π) — και
 * τότε η ζώνη θα κατέληγε σε **λάθος** Δημοτική Ενότητα.
 */

import { simplifyGeoRing } from '../../../src/lib/geo/geo-simplify';
import { greekGridToGeoPoint } from '../../../src/lib/geo/greek-grid';
import type { GeoOutline, GeoPoint } from '../../../src/types/geo/coordinates';
import type { BboxTuple } from '../../../src/lib/market/value-zone-file';
import type { ShapeCoordinate } from './shapefile';

type GridRing = readonly ShapeCoordinate[];

/** 6 δεκαδικά ≈ **0,11 m** — κάτω από κάθε ανοχή, ώστε η στρογγύλευση να μην τρώει την εγγύηση της απλοποίησης. */
const COORDINATE_DECIMALS = 6;

function round(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** Διπλάσιο προσημασμένο εμβαδόν (shoelace): **θετικό = αριστερόστροφα**. */
function signedArea2(ring: GridRing): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

function gridPointInRing(x: number, y: number, ring: GridRing): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ο ESRI δακτύλιος επαναλαμβάνει την πρώτη κορυφή στο τέλος· εδώ δουλεύουμε με ανοιχτούς. */
function openGridRing(ring: GridRing): GridRing {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

/** Δακτύλιοι → πολύγωνα `[εξωτερικός, ...τρύπες]` στον κάνναβο. Τρύπα χωρίς εξωτερικό αγνοείται (δεν περικλείει τίποτα). */
export function groupGridPolygons(parts: readonly GridRing[]): GridRing[][] {
  const rings = parts.map(openGridRing).filter((ring) => ring.length >= 3);
  const outers = rings.filter((ring) => signedArea2(ring) < 0);
  const polygons = outers.map((outer) => [outer]);
  for (const hole of rings.filter((ring) => signedArea2(ring) > 0)) {
    const [hx, hy] = hole[0];
    const owner = polygons.find((polygon) => gridPointInRing(hx, hy, polygon[0]));
    owner?.push(hole);
  }
  return polygons;
}

/**
 * **Σημείο εγγυημένα μέσα στη ζώνη** (όταν υπάρχει εσωτερικό): σάρωση στο μέσο του bbox του μεγαλύτερου εξωτερικού.
 * Οι τρύπες μετρούν (even–odd), άρα το σημείο δεν πέφτει ποτέ μέσα σε τρύπα.
 */
export function gridInteriorPoint(polygons: readonly GridRing[][]): ShapeCoordinate {
  const largest = [...polygons].sort((a, b) => Math.abs(signedArea2(b[0])) - Math.abs(signedArea2(a[0])))[0];
  const ys = largest[0].map(([, y]) => y);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const crossings: number[] = [];
  for (const ring of largest) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) crossings.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  crossings.sort((a, b) => a - b);
  let best: ShapeCoordinate = largest[0][0];
  let widest = -1;
  for (let k = 0; k + 1 < crossings.length; k += 2) {
    const width = crossings[k + 1] - crossings[k];
    if (width > widest) {
      widest = width;
      best = [(crossings[k] + crossings[k + 1]) / 2, y];
    }
  }
  return best;
}

function projectRing(ring: GridRing): GeoOutline {
  return ring.map(([easting, northing]) => greekGridToGeoPoint(easting, northing));
}

function roundedPositions(points: readonly GeoPoint[]): GeoJSON.Position[] {
  const out: GeoJSON.Position[] = [];
  for (const point of points) {
    const position: GeoJSON.Position = [round(point.lng), round(point.lat)];
    const previous = out[out.length - 1];
    if (previous === undefined || previous[0] !== position[0] || previous[1] !== position[1]) out.push(position);
  }
  return out;
}

/** Ανοιχτός δακτύλιος WGS84 → κλειστός GeoJSON, ή `null` αν εκφυλίστηκε μετά τη στρογγύλευση. */
function closedPositions(ring: GeoOutline): GeoJSON.Position[] | null {
  const positions = roundedPositions(ring);
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (positions.length > 1 && first[0] === last[0] && first[1] === last[1]) positions.pop();
  if (positions.length < 3) return null;
  return [...positions, positions[0]];
}

/**
 * Πολύγωνα καννάβου → **GeoJSON MultiPolygon** (WGS84, απλοποιημένο). `null` όταν ολόκληρη η ζώνη είναι μικρότερη από
 * την ανοχή — ο καλών τη μετρά στην αναφορά, δεν εξαφανίζεται σιωπηλά.
 */
export function toGeoMultiPolygon(polygons: readonly GridRing[][], toleranceM: number): GeoJSON.MultiPolygon | null {
  const coordinates: GeoJSON.Position[][][] = [];
  for (const [outer, ...holes] of polygons) {
    // Η σύμβαση ESRI είναι η ΑΝΤΙΘΕΤΗ του RFC 7946 και για τα δύο είδη ⇒ αντιστρέφονται ΟΛΟΙ οι δακτύλιοι
    // (εξωτερικός δεξιόστροφος → αριστερόστροφος· τρύπα αριστερόστροφη → δεξιόστροφη). Άγκυρα: zone-geometry.test.
    const outerRing = simplifiedClosed(outer, toleranceM);
    if (outerRing === null) continue;
    const holeRings = holes
      .map((hole) => simplifiedClosed(hole, toleranceM))
      .filter((ring): ring is GeoJSON.Position[] => ring !== null);
    coordinates.push([outerRing, ...holeRings]);
  }
  return coordinates.length === 0 ? null : { type: 'MultiPolygon', coordinates };
}

function simplifiedClosed(ring: GridRing, toleranceM: number): GeoJSON.Position[] | null {
  const simplified = simplifyGeoRing(projectRing(ring), toleranceM);
  return simplified === null ? null : closedPositions([...simplified].reverse());
}

/** Πολυγραμμές καννάβου → **GeoJSON MultiLineString** (WGS84). Χωρίς απλοποίηση: διάμεσος 9 κορυφές (μετρημένο). */
export function toGeoMultiLine(parts: readonly GridRing[]): GeoJSON.MultiLineString | null {
  const coordinates = parts
    .map((line) => roundedPositions(line.map(([easting, northing]) => greekGridToGeoPoint(easting, northing))))
    .filter((line) => line.length >= 2);
  return coordinates.length === 0 ? null : { type: 'MultiLineString', coordinates };
}

/** bbox όλων των θέσεων — σειρά GeoJSON. */
export function bboxOfPositions(positions: Iterable<GeoJSON.Position>): BboxTuple {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of positions) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

export function unionBbox(boxes: readonly BboxTuple[]): BboxTuple {
  return [
    Math.min(...boxes.map((box) => box[0])),
    Math.min(...boxes.map((box) => box[1])),
    Math.max(...boxes.map((box) => box[2])),
    Math.max(...boxes.map((box) => box[3])),
  ];
}
