/**
 * =============================================================================
 * POLYGON LABEL POINT (SSoT) — ο πόλος απροσπέλαστου: πού γράφεται η ετικέτα ενός πολυγώνου
 * =============================================================================
 *
 * Το **εσωτερικό** σημείο με τη **μέγιστη** απόσταση από το σύνορο, μαζί με αυτή την απόσταση (`clearance` = ακτίνα του
 * μεγαλύτερου εγγεγραμμένου κύκλου με κέντρο εκεί). Αλγόριθμος: Garcia-Castellanos & Lombardo (2007), όπως τον έκανε γνωστό
 * το `mapbox/polylabel` — πλέγμα κελιών που υποδιαιρούνται κατά σειρά **υπόσχεσης** (`d + h·√2` = το καλύτερο που θα μπορούσε
 * να δώσει οτιδήποτε μέσα στο κελί), με κλάδεμα όσων δεν μπορούν να ξεπεράσουν τον τρέχοντα νικητή κατά `precision`.
 * Δική μας υλοποίηση (όχι πακέτο: η άδεια ISC δεν είναι στη λίστα του N.5), πάνω στο `planar-polygon.ts`.
 *
 * 🔑 **Γιατί όχι κεντροειδές**: σε σαλόνι σχήματος Γ το κεντροειδές πέφτει **έξω** από τον χώρο (στη γωνία που λείπει) ή
 *   πάνω στον τοίχο· η ετικέτα «Σαλόνι ≈ 28 τ.μ.» θα κάθονταν στο διπλανό δωμάτιο. Εδώ είναι **εγγυημένα** μέσα, όσο πιο
 *   μακριά γίνεται από τους τοίχους — και το `clearance` λέει στον καλούντα αν **χωράει** η ετικέτα.
 * 🔑 **Χωρίς μονάδες**, όπως ο γείτονάς του: μέτρα στην περιήγηση (ADR-884 Γ3γ-1), mm στο dxf-viewer.
 *
 * @module lib/geometry/polygon-label-point
 */

import { distanceToRing, pointInPolygon, polygonArea, type PlanarPoint } from './planar-polygon';

export interface PolygonLabelPoint {
  readonly point: PlanarPoint;
  /** Απόσταση του σημείου από το πλησιέστερο σημείο του συνόρου (≥ 0). */
  readonly clearance: number;
}

interface Cell {
  readonly x: number;
  readonly y: number;
  /** Μισή πλευρά. */
  readonly h: number;
  /** Προσημασμένη απόσταση του κέντρου από το σύνορο (αρνητική έξω). */
  readonly d: number;
  /** Το καλύτερο δυνατό μέσα στο κελί. */
  readonly max: number;
}

/** Προσημασμένη απόσταση από το σύνορο: θετική μέσα, αρνητική έξω. */
function signedDistance(p: PlanarPoint, ring: readonly PlanarPoint[]): number {
  const d = distanceToRing(p, ring);
  return pointInPolygon(p, ring) ? d : -d;
}

function cellAt(x: number, y: number, h: number, ring: readonly PlanarPoint[]): Cell {
  const d = signedDistance({ x, y }, ring);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

/** Κεντροειδές εμβαδού — ο πρώτος υποψήφιος (για κυρτά είναι ήδη σχεδόν η απάντηση). */
function areaCentroid(ring: readonly PlanarPoint[]): PlanarPoint {
  let cx = 0, cy = 0, twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
    twiceArea += cross;
  }
  return twiceArea === 0 ? ring[0] : { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
}

function bounds(ring: readonly PlanarPoint[]) {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Αρχικό πλέγμα που καλύπτει όλο το ορθογώνιο περιβλήματος, με κελιά πλευράς = η μικρότερη διάσταση. */
function initialCells(ring: readonly PlanarPoint[], box: ReturnType<typeof bounds>): Cell[] {
  const size = Math.min(box.maxX - box.minX, box.maxY - box.minY);
  const h = size / 2;
  const cells: Cell[] = [];
  for (let x = box.minX; x < box.maxX; x += size) {
    for (let y = box.minY; y < box.maxY; y += size) cells.push(cellAt(x + h, y + h, h, ring));
  }
  return cells;
}

/** Ο πιο υποσχόμενος πρώτος — ουρά προτεραιότητας με δυαδική εισαγωγή (λίγες εκατοντάδες κελιά σε κάτοψη). */
function enqueue(queue: Cell[], cell: Cell): void {
  let lo = 0, hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (queue[mid].max < cell.max) lo = mid + 1; else hi = mid;
  }
  queue.splice(lo, 0, cell);
}

/**
 * **Ο πόλος απροσπέλαστου** ενός απλού πολυγώνου (δακτύλιος χωρίς επανάληψη της πρώτης κορυφής). `precision` = πόσο κοντά στο
 * βέλτιστο αρκεί (στις μονάδες του πολυγώνου). Εκφυλισμένο (< 3 κορυφές ή μηδενικό εμβαδόν) ⇒ η πρώτη κορυφή, `clearance` 0.
 */
export function polygonLabelPoint(ring: readonly PlanarPoint[], precision: number): PolygonLabelPoint {
  if (ring.length < 3 || polygonArea(ring) === 0) return { point: ring[0] ?? { x: 0, y: 0 }, clearance: 0 };
  const box = bounds(ring);
  const centroid = areaCentroid(ring);
  let best = cellAt(centroid.x, centroid.y, 0, ring);
  const boxCentre = cellAt((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, 0, ring);
  if (boxCentre.d > best.d) best = boxCentre;
  const queue: Cell[] = [];
  for (const cell of initialCells(ring, box)) enqueue(queue, cell);
  for (let cell = queue.pop(); cell !== undefined; cell = queue.pop()) {
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    const h = cell.h / 2;
    for (const [dx, dy] of [[-h, -h], [h, -h], [-h, h], [h, h]]) enqueue(queue, cellAt(cell.x + dx, cell.y + dy, h, ring));
  }
  return { point: { x: best.x, y: best.y }, clearance: Math.max(0, best.d) };
}
