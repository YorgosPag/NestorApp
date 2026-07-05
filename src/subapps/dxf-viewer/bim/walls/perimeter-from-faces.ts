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
 *   - loose-line loops → `findClosedPolygonsFromLines` (auto-area planar-face SSoT).
 *   - boolean union → `safeUnion` (polygon-clipping SSoT).
 *
 * Περιορισμός Φάσης 0/1: σχήματα με γωνίες ≠ 90° χαρακτηρίζονται 'composite' και ΔΕΝ
 * αποσυντίθενται σε rects (τοίχοι → αγνοούνται· τοιχία Φάσης 3 → ΕΝΑ composite column).
 * ADR-419 §planar-faces: τα loose-line loops πιάνονται με half-edge planar face traversal
 * → junctions βαθμού >2 (εφαπτόμενα σχήματα με κοινή κορυφή), αμβλείες γωνίες & κενά OK.
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
  type DetectedRectangle,
  type RegionLineSeg,
} from './wall-in-region';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { resolveRegionLoopTolerances } from './region-tolerance';
// ADR-419 §planar-faces — SSoT half-edge planar face traversal (auto-area). Χειρίζεται
// junctions βαθμού >2 + αμβλείες γωνίες + κενά μετά explode — ό,τι ΔΕΝ κάνει ο simple-cycle.
import { findClosedPolygonsFromLines } from '../../systems/auto-area/auto-area-geometry';
import type { SceneUnits } from '../../utils/scene-units';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import {
  EPS,
  normalize,
  polygonArea,
  classifyPerimeter,
  decomposeRectilinear,
  type PerimeterShape,
} from './perimeter-polygon-math';
// ADR-419 §thickness-zones — ΣΩΣΤΟ split τοίχων (centerline/grid, όχι slab-sweep λωρίδων):
// κάθε σκέλος = ΕΝΑΣ τοίχος πλήρους πάχους, κόψιμο στα junctions & αλλαγές πάχους.
import { decomposeWallsFromFootprint } from './wall-footprint-decompose';

// Public API backward-compat — pure polygon math lives in the split module.
export { classifyPerimeter, decomposeRectilinear } from './perimeter-polygon-math';
export type { PerimeterShape } from './perimeter-polygon-math';
// Public API backward-compat — pure measurement helpers (N.7.1 split).
export {
  perimeterMemberThicknessMm,
  perimeterExtentMm,
  isPerimeterOversized,
} from './perimeter-measure';
// Public API backward-compat — open-loop diagnostics (Layer 5, N.7.1 split).
export {
  findOpenChainLineIdsNear,
  findOpenChainEndpointsNear,
} from './perimeter-open-chain-diagnostics';

// ─── Public types ────────────────────────────────────────────────────────────

/** Ένα κλειστό περίγραμμα: εξώτατο πολύγωνο + κατηγορία + αποσύνθεση σε σκέλη. */
export interface ClosedPerimeter {
  /** Καθαρισμένο πολύγωνο (CCW, χωρίς διπλό κλείσιμο/συγγραμμικά). */
  readonly polygon: readonly Point2D[];
  readonly shape: PerimeterShape;
  /** Ορθογώνια σκέλη (κενό για 'composite'). */
  readonly rects: readonly DetectedRectangle[];
}

/**
 * SSoT — ένα ΑΥΘΑΙΡΕΤΟ κλειστό πολύγωνο (π.χ. σχεδιασμένο vertex-by-vertex από τον
 * χρήστη) → `ClosedPerimeter`, με την ΙΔΙΑ κανονικοποίηση/ταξινόμηση/αποσύνθεση που
 * χρησιμοποιεί το «από περίγραμμα» path (`perimeterFacesToRects`). Χρησιμοποιείται από
 * το column polygon-sketch mode (`buildColumnFromSketchedPolygon`) ώστε η σχεδιασμένη
 * περίμετρος να περνά από τον ΙΔΙΟ builder με τα περιγράμματα-από-γραμμές — μηδέν
 * παράλληλη geometry. `polygon` = normalized (CCW, χωρίς διπλό κλείσιμο/συγγραμμικά).
 */
export function polygonToClosedPerimeter(
  polygon: readonly Point2D[],
  tol: number,
): ClosedPerimeter {
  return {
    polygon: normalize(polygon, tol),
    shape: classifyPerimeter(polygon, tol),
    rects: decomposeRectilinear(polygon, tol),
  };
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
  return projectVerticesTo2D(verts);
}

/** RECTANGLE/RECT entity → 4 κορυφές, αλλιώς null. */
function rectEntityPolygon(e: Entity): Point2D[] | null {
  if (!(isRectangleEntity(e) || isRectEntity(e))) return null;
  const corners = rectangleCorners(e as Parameters<typeof rectangleCorners>[0]);
  return corners.length === 4 ? corners : null;
}

/**
 * Κλειστοί βρόχοι από αλυσίδες ανεξάρτητων γραμμών.
 *
 * ADR-419 §planar-faces (2026-07-03): reuse του SSoT **half-edge planar face
 * traversal** (`findClosedPolygonsFromLines`, auto-area). Αντικαθιστά τον
 * degree-2-only `walkSimpleCycle`, που «έχανε ΟΛΑ» τα loops σε κόμβους junction
 * βαθμού >2 — δηλ. σε ΚΑΘΕ exploded αρχιτεκτονική κάτοψη όπου το εξωτερικό
 * περίγραμμα μοιράζεται κορυφές με τους εσωτερικούς διαχωρισμούς («σκάρα»). Ο
 * νέος detector χειρίζεται junctions οποιουδήποτε βαθμού + αμβλείες/οξείες γωνίες
 * (atan2) + κενά/overshoot μετά explode (`gapTol`). Τα polygons δεν χρειάζονται
 * CCW/dedupe/collinear-removal εδώ — το κάνει `normalize()` στον orchestrator· το
 * `polygonKey` dedup + `pickSmallestContainingPerimeter` απορροφούν over-detection.
 */
function buildPolygonLoops(
  segs: readonly RegionLineSeg[],
  mergeTol: number,
  gapTol: number,
): Point2D[][] {
  if (segs.length < 3) return [];
  const pairs = segs.map((s) => [s.start, s.end] as const);
  return findClosedPolygonsFromLines(pairs, mergeTol, gapTol);
}

/**
 * Όλα τα κλειστά πολύγωνα από scene entities: κλειστά polylines + ορθογώνια
 * απευθείας· οι ανεξάρτητες γραμμές → `buildPolygonLoops` (planar face traversal,
 * ADR-419 §planar-faces).
 *
 * ADR-419 §planar-faces (2026-07-03): το παλιό `options.detectTouchingRects`
 * (corner-graph `findRectanglesFromSegments`) ΑΦΑΙΡΕΘΗΚΕ — ήταν workaround για την
 * αδυναμία του simple-cycle walker σε εφαπτόμενα ορθογώνια με κοινή κορυφή (κόμβος
 * βαθμού >2). Ο νέος half-edge planar detector πιάνει junctions εγγενώς, οπότε το
 * workaround έγινε περιττό (και προκαλούσε double-count λόγω collinear κορυφών από
 * το planarize). Dedup με `polygonKey`.
 */
export function extractClosedPolygons(
  entities: readonly Entity[],
  tol: number,
  mergeTol: number = tol,
): Point2D[][] {
  const polygons: Point2D[][] = [];
  const seen = new Set<string>();
  const push = (poly: Point2D[]): void => {
    if (poly.length < 3) return;
    // Dedup στο ΨΙΛΟΤΕΡΟ feature-tol (mergeTol), όχι στο gap-floor: αλλιώς δύο διακριτά
    // μικρά features 50mm μακριά κβαντίζονταν στο ίδιο κλειδί → false dedup.
    const key = polygonKey(poly, mergeTol);
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
  // Planar face traversal — μεμονωμένα ορθογώνια, κλειστά L/U/πολύγωνα, ΚΑΙ
  // εφαπτόμενα σχήματα με κοινή κορυφή (junctions βαθμού >2) ως loose lines.
  // ADR-419 §region-tolerance: node-merge (`mergeTol`) ΔΙΑΧΩΡΙΣΜΕΝΟ από gap-closure
  // (`tol` ως HPGAPTOL) — ο capped mergeTol αποτρέπει την κατάρρευση μικρών features
  // (κουτί με ακμή < gap-floor), ενώ τα κενά μεγάλων τοίχων κλείνουν μέσω bridging.
  for (const loop of buildPolygonLoops(segs, mergeTol, tol)) push(loop);

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
  if (polys.length <= 1) return polys.map(projectVerticesTo2D);
  const geoms = polys.map((p) => [p.map((q) => [q.x, q.y] as [number, number])]);
  const merged = safeUnion(geoms[0], ...geoms.slice(1));
  if (merged.length === 0) return polys.map(projectVerticesTo2D);
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
  options?: { readonly unionTouching?: boolean; readonly mergeTol?: number },
): PerimeterFacesResult {
  // ADR-419 §planar-faces: ο planar detector πιάνει ΗΔΗ τα εφαπτόμενα σχήματα με
  // κοινή κορυφή (junctions)· το union (column path) απλώς τα ραφράζει σε ΕΝΑ Γ/Τ/Π.
  // ADR-419 §region-tolerance: `options.mergeTol` (capped node-merge / feature epsilon)
  // ΔΙΑΧΩΡΙΣΜΕΝΟ από το `tol` (gap-closure). Το `tol` (≥50mm) χρησιμοποιείται ΜΟΝΟ για
  // το loop-closure bridging στο `buildPolygonLoops`. ΟΛΟ το downstream shape-math
  // (dedup / classify / decompose grid+filter / normalize collinear) πρέπει να τρέχει
  // στο ΨΙΛΟΤΕΡΟ `feat` — αλλιώς μια πλευρά < gap-floor (π.χ. 40mm) φιλτράρεται ως
  // degenerate ή οι κορυφές της dedup-άρονται → το μικρό feature χάνει τα σκέλη του.
  // Default `feat = tol` → μηδέν αλλαγή για callers με single tol (π.χ. tests).
  const feat = options?.mergeTol ?? tol;
  const closed = extractClosedPolygons(entities, tol, feat);
  const polys = options?.unionTouching ? unionTouchingPolygons(closed) : closed;
  const perimeters: ClosedPerimeter[] = [];
  let ignoredCount = 0;
  for (const polygon of polys) {
    const shape = classifyPerimeter(polygon, feat);
    // ADR-419 §thickness-zones — σπάσε ΚΑΘΕ ορθογωνικό περίγραμμα σε τοίχους: κάθε
    // σκέλος = ΕΝΑΣ τοίχος ΠΛΗΡΟΥΣ πάχους, κόψιμο στα junctions & στις αλλαγές πάχους
    // (junction → κύριος/μακρύτερος τοίχος). `decomposeWallsFromFootprint` (centerline/
    // grid) ΑΝΤΙ του slab-sweep `decomposeRectilinear` — ο slab έκοβε τον τοίχο σε λωρίδες
    // ΚΑΤΑ ΜΗΚΟΣ (face-to-face στη μεγάλη πλευρά, παράλογο). Μη-ορθογωνικά → [] (αγνοούνται).
    const rects = decomposeWallsFromFootprint(polygon, feat);
    perimeters.push({ polygon: normalize(polygon, feat), shape, rects });
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
  Map<string, readonly ClosedPerimeter[]>
>();
let _lastLineSig = '';
let _lastTolKey = '';
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
  mergeTol: number = tol,
): readonly ClosedPerimeter[] {
  // αποφυγή cache-miss σε sub-pixel float drift· ΚΑΙ οι δύο ανοχές στο κλειδί (ADR-419
  // §region-tolerance — node-merge + gap-closure διαχωρισμένα).
  const key = `${Math.round(tol * 1000)}:${Math.round(mergeTol * 1000)}`;
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
      : perimeterFacesToRects(entities, tol, { mergeTol }).perimeters;
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
  // ADR-419 §region-tolerance: node-merge (`mergeTol`, capped) ΔΙΑΧΩΡΙΣΜΕΝΟ από το
  // gap-closure (`gapTol`, 50mm floor) ώστε μικρά κλειστά features να μην καταρρέουν.
  // Επιστρέφουμε το `gapTol` ως `tol` — αυτό τροφοδοτεί τα open-chain diagnostics
  // (`findOpenChain*Near` reach) που θέλουν τη γενναιόδωρη ανοχή.
  const { mergeTol, gapTol } = resolveRegionLoopTolerances(sceneUnits);
  const perimeter = pickSmallestContainingPerimeter(
    point,
    getCachedRegionPerimeters(entities, gapTol, mergeTol),
  );
  return { perimeter, tol: gapTol };
}
