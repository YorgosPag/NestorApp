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
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isRectEntity,
  isSpaceSeparatorEntity,
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
import { resolveRegionLoopTolWorld } from './region-tolerance';
import type { SceneUnits } from '../../utils/scene-units';
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
// Public API backward-compat — pure measurement helpers (N.7.1 split).
export {
  perimeterMemberThicknessMm,
  perimeterExtentMm,
  isPerimeterOversized,
} from './perimeter-measure';

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

/**
 * Layer 5 — open-loop diagnostics: ids των γραμμών κοντά στο `point` που έχουν
 * **ανοιχτό άκρο** (κόμβος βαθμού 1 στον γράφο των segments) — αυτές «δεν
 * ενώνονται» (Revit «these lines don't connect»). Reuse `extractLineSegments` +
 * `buildSegmentGraph`. Επιστρέφει deduped ids για highlight μέσω `dxf.highlightByIds`.
 */
// ─── Cached region-perimeter detection (SSoT, κοινό hover + click) ────────────
// Η ανίχνευση `perimeterFacesToRects` είναι O(n²) (segment graph) — ΑΠΑΓΟΡΕΥΕΤΑΙ να
// τρέχει σε κάθε mousemove ΚΑΙ σε κάθε κλικ δημιουργίας (~1.5s freeze σε μεγάλο
// σχέδιο). Αυτό το cache (mirror auto-area `getCachedClosedFaces`) εγγυάται ότι η
// O(n²) τρέχει ΜΙΑ φορά ανά (σύνολο γραμμών, tol): το ίδιο αποτέλεσμα μοιράζονται
// hover preview + click-inside commit. 2-level:
//   1) WeakMap<entities ref → tol → perimeters> — O(1) όσο ο πίνακας entities μένει ίδιος.
//   2) Content fallback σε ref-miss (π.χ. μόλις δημιουργήθηκε κολώνα → νέος πίνακας
//      αλλά ΙΔΙΕΣ γραμμές): φθηνή O(n) υπογραφή γραμμών· αν δεν άλλαξαν → reuse
//      χωρίς recompute (μια κολώνα δεν είναι γραμμή → κανένα νέο loop).
const _regionPerimeterCache = new WeakMap<
  readonly Entity[],
  Map<number, readonly ClosedPerimeter[]>
>();
let _lastLineSig = '';
let _lastTolKey = Number.NaN;
let _lastRegionPerimeters: readonly ClosedPerimeter[] = [];

/** Φθηνή (O(n)) υπογραφή ΜΟΝΟ των γραμμών — αλλάζει μόνο όταν αλλάζουν οι παρειές. */
function regionLineSignature(entities: readonly Entity[]): string {
  let lines = 0;
  let polys = 0;
  let verts = 0;
  // ADR-437 — οι διαχωριστές χώρου συμμετέχουν στην ανίχνευση περιοχής (ως segments).
  // ΧΩΡΙΣ μέτρησή τους εδώ, η προσθήκη/διαγραφή διαχωριστή ΔΕΝ σπάει το content-fallback
  // cache (ίδια υπογραφή πριν/μετά) → ο διαχωριστής γίνεται αόρατος στον detector.
  let seps = 0;
  for (const e of entities) {
    if (isLineEntity(e)) lines++;
    else if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
      polys++;
      verts += e.vertices?.length ?? 0;
    } else if (isSpaceSeparatorEntity(e)) seps++;
  }
  return `${lines}:${polys}:${verts}:${seps}`;
}

/**
 * Cached `perimeterFacesToRects(entities, tol).perimeters` (unionTouching=false) —
 * SSoT για το «μικρότερο εμπεριέχον loop» path (hover preview + click-inside σε
 * κολώνες/τοίχους). Αποφεύγει το O(n²) recompute σε κάθε move/click.
 */
export function getCachedRegionPerimeters(
  entities: readonly Entity[],
  tol: number,
): readonly ClosedPerimeter[] {
  const key = Math.round(tol * 1000); // αποφυγή cache-miss σε sub-pixel float drift
  let byTol = _regionPerimeterCache.get(entities);
  if (byTol) {
    const cached = byTol.get(key);
    if (cached) return cached; // fast path: ίδιος πίνακας entities (pan/hover/click)
  } else {
    byTol = new Map();
    _regionPerimeterCache.set(entities, byTol);
  }
  const sig = regionLineSignature(entities);
  const result =
    sig === _lastLineSig && key === _lastTolKey
      ? _lastRegionPerimeters
      : perimeterFacesToRects(entities, tol).perimeters;
  _lastLineSig = sig;
  _lastTolKey = key;
  _lastRegionPerimeters = result;
  byTol.set(key, result);
  return result;
}

/** Αποτέλεσμα του `pickRegionPerimeterAt`: το επιλεγμένο loop + η ανοχή που χρησιμοποιήθηκε. */
export interface RegionPerimeterPick {
  /** Το μικρότερο εμπεριέχον περίγραμμα κάτω από το σημείο (ή `null`). */
  readonly perimeter: ClosedPerimeter | null;
  /** Η units-aware ανοχή βρόχου — για τυχόν open-chain diagnostics στον caller. */
  readonly tol: number;
}

/**
 * Layer 1 SSoT (κοινό click + hover): επιστρέφει το **μικρότερο εμπεριέχον**
 * περίγραμμα κάτω από το `point`, με την units-aware ανοχή βρόχου. Ενοποιεί το
 * τριπλό `resolveRegionLoopTolWorld` → `getCachedRegionPerimeters` →
 * `pickSmallestContainingPerimeter` που ζούσε **αυτολεξεί** σε 5 σημεία
 * (thermal-space, wall-region, column-perimeter, region-mousemove, hatch pick-point).
 * Επιστρέφει και το `tol` ώστε ο caller να μην το ξαναϋπολογίζει για το
 * `findOpenChainLineIdsNear` (open-loop diagnostics).
 */
export function pickRegionPerimeterAt(
  point: Readonly<Point2D>,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
): RegionPerimeterPick {
  const tol = resolveRegionLoopTolWorld(sceneUnits);
  const perimeter = pickSmallestContainingPerimeter(point, getCachedRegionPerimeters(entities, tol));
  return { perimeter, tol };
}

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
