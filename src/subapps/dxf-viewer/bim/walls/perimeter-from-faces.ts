/**
 * ADR-363 — «Δομικά στοιχεία από περίγραμμα»: κοινό perimeter-from-faces SSoT (Φάση 0).
 *
 * Παίρνεις τις ΠΑΡΕΙΕΣ (περιγράμματα) ενός δομικού στοιχείου — κλειστά polylines /
 * ορθογώνια / αλυσίδες ανεξάρτητων γραμμών — και βγάζεις:
 *   1) τα κλειστά πολύγωνα (εξώτατη περίμετρος ανά στοιχείο),
 *   2) την ΚΑΤΗΓΟΡΙΑ σχήματος (ευθύ/Γ/Τ/Π/σύνθετο) από ορθές/ανακλαστικές γωνίες,
 *   3) την ΑΠΟΣΥΝΘΕΣΗ σε ορθογώνια σκέλη (slab sweep) → πάχος ανά σκέλος = μικρή πλευρά.
 *
 * Η καθαρή γεωμετρία πολυγώνου (κανονικοποίηση/κατηγοριοποίηση/αποσύνθεση) ζει στο
 * `./perimeter-polygon-math.ts` (N.7.1 split)· εδώ μένει η εξαγωγή από scene entities,
 * το union γειτονικών και ο orchestrator. Τα `classifyPerimeter`/`decomposeRectilinear`/
 * `PerimeterShape` re-export-άρονται για backward-compat του public API.
 *
 * Κοινό SSoT για ΔΥΟ builders (Giorgio 2026-06-01):
 *   - ΤΟΙΧΟΣ  → rects → `buildWallFillingRect` ×N (αλυσίδα WallEntity + miter στον caller).
 *   - ΤΟΙΧΙΟ  → polygon + shape → ColumnEntity (Φάση 3).
 *
 * ΚΑΜΙΑ αναπαραγωγή geometry math πέρα από το shape analysis:
 *   - rectangle entity corners → `rectangleCorners` (wall-from-entity).
 *   - scene → segments → `extractLineSegments` (wall-in-region).
 *   - rect detection → `findRectanglesFromSegments` (wall-in-region).
 *   - boolean union → `safeUnion` (polygon-clipping SSoT).
 *
 * Περιορισμός Φάσης 0/1: σχήματα με γωνίες ≠ 90° χαρακτηρίζονται 'composite' και ΔΕΝ
 * αποσυντίθενται σε rects (τοίχοι → αγνοούνται· τοιχία Φάσης 3 → ΕΝΑ composite column).
 * Loose-line loops πιάνονται ως καθαρός απλός κύκλος (κάθε κόμβος βαθμού 2)· εφαπτόμενα
 * ορθογώνια με κοινή κορυφή πιάνονται από τον rectangle detector (`detectTouchingRects`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 * @see ./perimeter-polygon-math.ts (pure polygon math)
 * @see ./wall-in-region.ts (rect detection + filling-wall builder)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isRectEntity,
} from '../../types/entities';
import { rectangleCorners } from './wall-from-entity';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  type DetectedRectangle,
  type RegionLineSeg,
} from './wall-in-region';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';
import {
  EPS,
  dist,
  normalize,
  polygonArea,
  classifyPerimeter,
  decomposeRectilinear,
  type PerimeterShape,
} from './perimeter-polygon-math';

// Public API backward-compat — pure polygon math lives in the split module.
export { classifyPerimeter, decomposeRectilinear } from './perimeter-polygon-math';
export type { PerimeterShape } from './perimeter-polygon-math';

// ─── Public types ────────────────────────────────────────────────────────────

/** Ένα κλειστό περίγραμμα: εξώτατο πολύγωνο + κατηγορία + αποσύνθεση σε σκέλη. */
export interface ClosedPerimeter {
  /** Καθαρισμένο πολύγωνο (CCW, χωρίς διπλό κλείσιμο/συγγραμμικά). */
  readonly polygon: readonly Point2D[];
  readonly shape: PerimeterShape;
  /** Ορθογώνια σκέλη (κενό για 'composite'). */
  readonly rects: readonly DetectedRectangle[];
}

/** Αποτέλεσμα ανάλυσης μιας μικτής επιλογής. */
export interface PerimeterFacesResult {
  readonly perimeters: readonly ClosedPerimeter[];
  /** Όλα τα σκέλη όλων των αποσυντιθέμενων περιμέτρων (flatten). */
  readonly rects: readonly DetectedRectangle[];
  /** Κλειστά σχήματα που δεν έδωσαν κανένα σκέλος (composite/άκυρα) → toast. */
  readonly ignoredCount: number;
}

/**
 * Κλειδί ταυτότητας πολυγώνου ανεξάρτητο σειράς (κβαντισμένο σε `tol`) — για dedup
 * όταν το ΙΔΙΟ ορθογώνιο εξάγεται ΚΑΙ ως απλός κύκλος ΚΑΙ από τον rectangle detector.
 */
function polygonKey(poly: readonly Point2D[], tol: number): string {
  const q = Math.max(tol, EPS);
  return poly
    .map((p) => `${Math.round(p.x / q)},${Math.round(p.y / q)}`)
    .sort()
    .join('|');
}

// ─── Closed-polygon extraction from scene entities ───────────────────────────

/** Κλειστό polyline/lwpolyline (≥3 κορυφές) → πολύγωνο, αλλιώς null. */
function closedPolylinePolygon(e: Entity): Point2D[] | null {
  if (!(isPolylineEntity(e) || isLWPolylineEntity(e))) return null;
  const verts = e.vertices;
  if (!e.closed || !verts || verts.length < 3) return null;
  return verts.map((v) => ({ x: v.x, y: v.y }));
}

/** RECTANGLE/RECT entity → 4 κορυφές, αλλιώς null. */
function rectEntityPolygon(e: Entity): Point2D[] | null {
  if (!(isRectangleEntity(e) || isRectEntity(e))) return null;
  const corners = rectangleCorners(e as Parameters<typeof rectangleCorners>[0]);
  return corners.length === 4 ? corners : null;
}

/** Γράφος κόμβων/γειτνίασης από segments (συγχώνευση άκρων εντός tol). */
function buildSegmentGraph(
  segs: readonly RegionLineSeg[],
  tol: number,
): { nodes: Point2D[]; adj: number[][] } {
  const nodes: Point2D[] = [];
  const adj: number[][] = [];
  const indexOf = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      if (dist(nodes[i], p) <= tol) return i;
    }
    nodes.push({ x: p.x, y: p.y });
    adj.push([]);
    return nodes.length - 1;
  };
  for (const s of segs) {
    const a = indexOf(s.start);
    const b = indexOf(s.end);
    if (a === b) continue;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return { nodes, adj };
}

/** Διατρέχει απλό κύκλο από `start` (όλοι οι κόμβοι βαθμού 2). null αν δεν κλείνει. */
function walkSimpleCycle(start: number, adj: readonly number[][]): number[] | null {
  const cycle = [start];
  let prev = -1;
  let cur = start;
  while (true) {
    const nbrs = adj[cur];
    if (nbrs.length !== 2) return null;
    const next = nbrs[0] === prev ? nbrs[1] : nbrs[0];
    if (next === start) return cycle;
    if (cycle.includes(next) || cycle.length > 4096) return null;
    cycle.push(next);
    prev = cur;
    cur = next;
  }
}

/** Κλειστοί βρόχοι από αλυσίδες ανεξάρτητων γραμμών (καθαροί απλοί κύκλοι μόνο). */
function buildPolygonLoops(segs: readonly RegionLineSeg[], tol: number): Point2D[][] {
  if (segs.length < 3) return [];
  const { nodes, adj } = buildSegmentGraph(segs, tol);
  const loops: Point2D[][] = [];
  const visited = new Set<number>();
  for (let s = 0; s < nodes.length; s++) {
    if (visited.has(s) || adj[s].length !== 2) continue;
    const cycle = walkSimpleCycle(s, adj);
    visited.add(s);
    if (!cycle) continue;
    cycle.forEach((i) => visited.add(i));
    if (cycle.length >= 4) loops.push(cycle.map((i) => nodes[i]));
  }
  return loops;
}

/**
 * Όλα τα κλειστά πολύγωνα από scene entities: κλειστά polylines + ορθογώνια
 * απευθείας· οι ανεξάρτητες γραμμές αλυσιδώνονται σε καθαρούς απλούς κύκλους.
 *
 * `options.detectTouchingRects` (ADR-363 Phase 3b fix): τρέχει ΕΠΙΣΗΣ τον
 * corner-graph rectangle detector (`findRectanglesFromSegments`) στις σκόρπιες
 * γραμμές. Χρειάζεται όταν δύο εφαπτόμενα ορθογώνια (π.χ. Γ/L) σχεδιάζονται με
 * γραμμές που ΜΟΙΡΑΖΟΝΤΑΙ κορυφή: ο κοινός κόμβος γίνεται βαθμού >2 και ο
 * αυστηρός simple-cycle walker (`buildPolygonLoops`) τα χάνει ΟΛΑ. Ο detector τα
 * πιάνει ξεχωριστά· ο caller (`perimeterFacesToRects` με `unionTouching`) τα ενώνει
 * μετά σε Γ/Τ/Π — και το union απορροφά τυχόν over-detected υπο-ορθογώνια στο
 * τελικό περίγραμμα (γι' αυτό ενεργοποιείται μόνο μαζί με `unionTouching`). Τα
 * dedup με `polygonKey` ώστε ένα μεμονωμένο ορθογώνιο (που πιάνεται ΚΑΙ από τον
 * walker ΚΑΙ από τον detector) να μην μετρηθεί διπλά.
 */
export function extractClosedPolygons(
  entities: readonly Entity[],
  tol: number,
  options?: { readonly detectTouchingRects?: boolean },
): Point2D[][] {
  const polygons: Point2D[][] = [];
  const seen = new Set<string>();
  const push = (poly: Point2D[]): void => {
    if (poly.length < 3) return;
    const key = polygonKey(poly, tol);
    if (seen.has(key)) return;
    seen.add(key);
    polygons.push(poly);
  };

  const looseEntities: Entity[] = [];
  for (const e of entities) {
    const poly = closedPolylinePolygon(e) ?? rectEntityPolygon(e);
    if (poly) push(poly);
    else looseEntities.push(e);
  }

  const segs = extractLineSegments(looseEntities);
  // Καθαροί απλοί κύκλοι (μεμονωμένο ορθογώνιο, κλειστά L/U/πολύγωνα ως loose lines).
  for (const loop of buildPolygonLoops(segs, tol)) push(loop);
  // Εφαπτόμενα ορθογώνια με κοινή κορυφή — βλ. doc παραπάνω.
  if (options?.detectTouchingRects) {
    for (const rect of findRectanglesFromSegments(segs, tol)) push([...rect.polygon]);
  }

  return polygons;
}

// ─── Polygon union (ADR-363 Phase 3b — γειτονικά πλαίσια → ΕΝΑ σχήμα) ─────────

/**
 * Convert ένα ring polygon-clipping `[number,number][]` πίσω σε `Point2D[]`,
 * αφαιρώντας το διπλό κλείσιμο (polygon-clipping κλείνει τα rings: first===last).
 */
function ringToPoints(ring: ReadonlyArray<readonly [number, number]>): Point2D[] {
  const pts = ring.map(([x, y]) => ({ x, y }));
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
  }
  return pts;
}

/**
 * Ενώνει γειτονικά/επικαλυπτόμενα κλειστά πολύγωνα σε ΕΝΑ περίγραμμα (ADR-363
 * Phase 3b). Γιατί: ένα τοιχίο σχήματος Π σχεδιασμένο ως 3 χωριστά ορθογώνια
 * είναι **ΕΝΑ φέρον στοιχείο** (Eurocode 8 — σύνθετη στατική λειτουργία, ενιαίο
 * κεντροειδές/ροπές αδρανείας/κέντρο διάτμησης), όχι τρία. Το boolean `safeUnion`
 * (polygon-clipping SSoT) ενώνει εφαπτόμενα/επικαλυπτόμενα και κρατά τα ασύνδετα
 * ΧΩΡΙΣΤΑ (κάθε στοιχείο = δικό του τοιχίο). Holes αγνοούνται (μόνο outer ring)·
 * empty union → fallback στα αρχικά (zero data loss). Pure — wrapper του SSoT.
 */
function unionTouchingPolygons(
  polys: ReadonlyArray<readonly Point2D[]>,
): Point2D[][] {
  const copy = (p: readonly Point2D[]): Point2D[] => p.map((q) => ({ x: q.x, y: q.y }));
  if (polys.length <= 1) return polys.map(copy);
  const geoms = polys.map((p) => [p.map((q) => [q.x, q.y] as [number, number])]);
  const merged = safeUnion(geoms[0], ...geoms.slice(1));
  if (merged.length === 0) return polys.map(copy);
  return merged.map((polygon) => ringToPoints(polygon[0]));
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Ανάλυση μιας επιλογής παρειών → περιγράμματα + σκέλη + πλήθος αγνοημένων.
 * Composite/άκυρα κλειστά σχήματα δεν παράγουν σκέλη (ignoredCount → toast).
 *
 * `options.unionTouching` (ADR-363 Phase 3b): ενώνει γειτονικά/επικαλυπτόμενα
 * κλειστά σχήματα σε ΕΝΑ περίγραμμα ΠΡΙΝ την κατηγοριοποίηση (3 ορθογώνια Π → ΕΝΑ
 * τοιχίο Π). Default `false` — οι τοίχοι κρατούν την ανά-σχήμα συμπεριφορά (δύο
 * γειτονικά δωμάτια ≠ ένα). Το column path (`perimeterFacesToColumns`) το ανάβει.
 */
export function perimeterFacesToRects(
  entities: readonly Entity[],
  tol: number,
  options?: { readonly unionTouching?: boolean },
): PerimeterFacesResult {
  // Phase 3b fix: όταν θα ενώσουμε (column path), εξάγουμε ΚΑΙ τα εφαπτόμενα
  // ορθογώνια (κοινή κορυφή → ο simple-cycle walker τα χάνει)· το union τα ραφράζει.
  const closed = extractClosedPolygons(entities, tol, {
    detectTouchingRects: options?.unionTouching,
  });
  const polys = options?.unionTouching ? unionTouchingPolygons(closed) : closed;
  const perimeters: ClosedPerimeter[] = [];
  let ignoredCount = 0;
  for (const polygon of polys) {
    const shape = classifyPerimeter(polygon, tol);
    const rects = shape === 'composite' ? [] : decomposeRectilinear(polygon, tol);
    perimeters.push({ polygon: normalize(polygon, tol), shape, rects });
    if (rects.length === 0) ignoredCount++;
  }
  return { perimeters, rects: perimeters.flatMap((p) => [...p.rects]), ignoredCount };
}

// ─── ADR-419 region-pick SSoT (κοινό κολώνες + τοίχοι, μηδέν fork) ─────────────

/**
 * Layer 1 — «smallest-containing-loop selection» (Revit-grade): από όλα τα
 * περιγράμματα που περιέχουν το `point`, κρατά αυτό με το **ελάχιστο εμβαδόν**
 * (το πιο εσωτερικό φωλιασμένο loop), όχι όλα. `null` αν κανένα δεν περιέχει το
 * σημείο. Mirror του auto-area `getAutoAreaHitResult` (`candidates.reduce` min-area).
 *
 * Γιατί: όταν το σημείο πέφτει ΚΑΙ μέσα στο μεγάλο εξωτερικό περίγραμμα του σχεδίου
 * ΚΑΙ μέσα σε ένα μικρό δωμάτιο, το παλιό filter κρατούσε ΚΑΙ τα δύο → γιγάντια
 * κολώνα. Το ελάχιστο εμβαδόν επιλέγει το σωστό (εσωτερικό) μέλος.
 */
export function pickSmallestContainingPerimeter(
  point: Readonly<Point2D>,
  perimeters: readonly ClosedPerimeter[],
): ClosedPerimeter | null {
  let best: ClosedPerimeter | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const p of perimeters) {
    if (!isPointInPolygon(point as Point2D, [...p.polygon])) continue;
    const area = polygonArea(p.polygon);
    if (area < bestArea) {
      best = p;
      bestArea = area;
    }
  }
  return best;
}

/** Axis-aligned bbox min/max ενός πολυγώνου (world/scene units). */
function bboxExtent(poly: readonly Point2D[]): { width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * Χαρακτηριστικό «πάχος» (μικρή πλευρά) ενός περιγράμματος σε mm (Layer 4). Για
 * ορθογώνια/αποσυντιθέμενα σχήματα = το **παχύτερο σκέλος** (max `shortSide`):
 * ένα πραγματικό Γ/Τ/Π τοιχίο έχει λεπτά σκέλη, ενώ το εξωτερικό περίγραμμα του
 * σχεδίου αποσυντίθεται σε «σκέλη» τεράστιου πάχους. Για καθαρά composite (γωνίες
 * ≠ 90°, χωρίς rects) fallback στη μικρή διάσταση του bbox.
 *
 * @param scale mmToSceneUnits(sceneUnits) — world units ανά mm.
 */
export function perimeterMemberThicknessMm(perimeter: ClosedPerimeter, scale: number): number {
  const s = scale > 0 ? scale : 1;
  if (perimeter.rects.length > 0) {
    const maxShort = Math.max(...perimeter.rects.map((r) => r.shortSide));
    return maxShort / s;
  }
  const { width, height } = bboxExtent(perimeter.polygon);
  return Math.min(width, height) / s;
}

/**
 * Διαστάσεις bbox ενός περιγράμματος σε mm (για toast/preview labels). `scale` =
 * mmToSceneUnits(sceneUnits) — world units ανά mm.
 */
export function perimeterExtentMm(
  perimeter: ClosedPerimeter,
  scale: number,
): { width: number; height: number } {
  const s = scale > 0 ? scale : 1;
  const { width, height } = bboxExtent(perimeter.polygon);
  return { width: width / s, height: height / s };
}

/**
 * Layer 4 — size sanity guard: `true` αν το περίγραμμα ξεπερνά το λογικό «πάχος»
 * δομικού μέλους (`MAX_MEMBER_THICKNESS_MM`). Πιάνει το εξωτερικό περίγραμμα του
 * σχεδίου που περνούσε για κολώνα (το bug). Ελέγχει ΜΟΝΟ τη μικρή πλευρά.
 */
export function isPerimeterOversized(
  perimeter: ClosedPerimeter,
  scale: number,
  maxMm: number = REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM,
): boolean {
  return perimeterMemberThicknessMm(perimeter, scale) > maxMm;
}

/**
 * Layer 5 — open-loop diagnostics: ids των γραμμών κοντά στο `point` που έχουν
 * **ανοιχτό άκρο** (κόμβος βαθμού 1 στον γράφο των segments) — αυτές «δεν
 * ενώνονται» (Revit «these lines don't connect»). Reuse `extractLineSegments` +
 * `buildSegmentGraph`. Επιστρέφει deduped ids για highlight μέσω `dxf.highlightByIds`.
 */
export function findOpenChainLineIdsNear(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  tol: number,
): string[] {
  const segs = extractLineSegments(entities);
  if (segs.length === 0) return [];
  const { nodes, adj } = buildSegmentGraph(segs, tol);
  // Ανοιχτά άκρα = κόμβοι βαθμού 1· κρατάμε όσα είναι κοντά στο pick (εντός 50×tol).
  const reach = Math.max(tol * 50, tol);
  const openNodes = new Set<number>();
  for (let i = 0; i < nodes.length; i++) {
    if (adj[i].length === 1 && dist(nodes[i], point as Point2D) <= reach) openNodes.add(i);
  }
  if (openNodes.size === 0) return [];
  const ids = new Set<string>();
  for (const s of segs) {
    if (!s.id) continue;
    const a = nodes.findIndex((n) => dist(n, s.start) <= tol);
    const b = nodes.findIndex((n) => dist(n, s.end) <= tol);
    if (openNodes.has(a) || openNodes.has(b)) ids.add(s.id);
  }
  return [...ids];
}
