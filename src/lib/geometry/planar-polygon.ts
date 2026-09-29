/**
 * =============================================================================
 * PLANAR POLYGON (SSoT) — εμβαδόν, σημείο-μέσα, αυτοτομή, απόσταση σημείου–τμήματος
 * =============================================================================
 *
 * Καθαρή επίπεδη γεωμετρία **χωρίς μονάδες** (mm στο dxf-viewer, μέτρα στην περιήγηση, pixel στην ανίχνευση
 * χώρων). Ζούσε στο `subapps/dxf-viewer/bim/geometry/shared/polygon-utils.ts` + `utils/geometry/GeometryUtils.ts`,
 * που **επανεξάγουν** πλέον από εδώ (πρότυπο `scalar.ts` / `angle.ts`): η δημόσια περιήγηση (ADR-884 §4.14 Γ3)
 * χρειάζεται τις ίδιες ερωτήσεις και δεν επιτρέπεται να εισάγει από το subapp (CHECK 3.62).
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή εδώ.** Η αξία του αρχείου είναι ότι δεν σέρνει τίποτα.
 *
 * @module lib/geometry/planar-polygon
 */

/** Σημείο στο επίπεδο — ό,τι δεν διαβάζει `z` δηλώνει αυτό (ADR-789). */
export interface PlanarPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Προσημασμένο εμβαδόν (Gauss / shoelace): θετικό αριστερόστροφα, αρνητικό δεξιόστροφα.
 * `0` για λιγότερες από 3 κορυφές.
 */
export function shoelaceArea(vertices: readonly PlanarPoint[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Εμβαδόν χωρίς πρόσημο — πάντα ≥ 0. */
export function polygonArea(vertices: readonly PlanarPoint[]): number {
  return Math.abs(shoelaceArea(vertices));
}

/**
 * Σημείο μέσα σε πολύγωνο — ray casting, κανόνας **even-odd**. Το σύνορο δεν έχει ντετερμινιστική απάντηση·
 * όπου χρειάζεται, το dxf-viewer έχει την τριαδική `locatePointInPolygon` (ADR-730).
 */
export function pointInPolygon(point: PlanarPoint, vertices: readonly PlanarPoint[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Προσανατολισμός τριάδας: θετικό αριστερόστροφα, αρνητικό δεξιόστροφα, μηδέν συνευθειακά. */
function orientation(o: PlanarPoint, a: PlanarPoint, b: PlanarPoint): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Το `p` (συνευθειακό) πέφτει μέσα στο ορθογώνιο περιβάλλον του `se`. */
function withinBox(p: PlanarPoint, s: PlanarPoint, e: PlanarPoint): boolean {
  return Math.min(s.x, e.x) <= p.x && p.x <= Math.max(s.x, e.x) &&
    Math.min(s.y, e.y) <= p.y && p.y <= Math.max(s.y, e.y);
}

/** Τέμνονται τα τμήματα `a1a2` και `b1b2`; — **μαζί** με την επαφή (άκρο πάνω σε τμήμα). */
export function segmentsIntersect(
  a1: PlanarPoint, a2: PlanarPoint,
  b1: PlanarPoint, b2: PlanarPoint,
): boolean {
  const d1 = orientation(b1, b2, a1);
  const d2 = orientation(b1, b2, a2);
  const d3 = orientation(a1, a2, b1);
  const d4 = orientation(a1, a2, b2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && withinBox(a1, b1, b2)) return true;
  if (d2 === 0 && withinBox(a2, b1, b2)) return true;
  if (d3 === 0 && withinBox(b1, a1, a2)) return true;
  if (d4 === 0 && withinBox(b2, a1, a2)) return true;
  return false;
}

/**
 * Αυτοτομή κλειστού πολυγώνου (O(n²)): δύο **μη γειτονικές** ακμές τέμνονται. Αρκεί για περιγράμματα
 * λίγων εκατοντάδων κορυφών (ο έλεγχος της περιήγησης δέχεται ≤ 200).
 */
export function isPolygonSelfIntersecting(vertices: readonly PlanarPoint[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Η πρώτη και η τελευταία ακμή μοιράζονται την κορυφή 0 — γειτονικές.
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(a1, a2, vertices[j], vertices[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Το πλησιέστερο σημείο ενός **τμήματος** (όχι ευθείας): η προβολή κόβεται στο `[0, 1]`. Εκφυλισμένο τμήμα (`a === b`)
 * δίνει το `a`. Η **μία** προβολή — την καλούν η απόσταση και η έλξη (`planar-snap.ts`).
 */
export function closestPointOnSegment(point: PlanarPoint, a: PlanarPoint, b: PlanarPoint): PlanarPoint {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const rawT = lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  const t = Math.min(1, Math.max(0, rawT));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** Απόσταση σημείου από **τμήμα** (όχι ευθεία) — βλ. {@link closestPointOnSegment}. */
export function distanceToSegment(point: PlanarPoint, a: PlanarPoint, b: PlanarPoint): number {
  const on = closestPointOnSegment(point, a, b);
  return Math.hypot(point.x - on.x, point.y - on.y);
}

/**
 * Απόσταση σημείου από το **σύνορο** ενός κλειστού δακτυλίου (χωρίς επανάληψη της πρώτης κορυφής) — η μικρότερη προς κάθε
 * ακμή. Ίδια απάντηση μέσα κι έξω· το πρόσημο (μέσα/έξω) το προσθέτει ο καλών με το {@link pointInPolygon}.
 * `+∞` για κενό δακτύλιο.
 */
export function distanceToRing(point: PlanarPoint, ring: readonly PlanarPoint[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i++) {
    const d = distanceToSegment(point, ring[i], ring[(i + 1) % ring.length]);
    if (d < min) min = d;
  }
  return min;
}
