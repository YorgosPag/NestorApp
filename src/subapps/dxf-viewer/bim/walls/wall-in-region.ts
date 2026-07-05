/**
 * ADR-363 Phase 1K — «Τοίχος σε περιοχή (4 γραμμές)» geometry SSoT (pure).
 *
 * Δίνεις ένα σύνολο ανεξάρτητων γραμμών (line segments)· βρίσκει ποιες 4 από
 * αυτές ενώνονται και σχηματίζουν ΚΛΕΙΣΤΟ ΟΡΘΟΓΩΝΙΟ (ή τετράγωνο), και
 * κατασκευάζει ΕΝΑΝ γεμάτο τοίχο που γεμίζει την περιοχή: μήκος = μεγάλη
 * πλευρά, πάχος = μικρή πλευρά (Giorgio 2026-05-30).
 *
 * ΚΑΜΙΑ αναπαραγωγή geometry math πέρα από το rectangle detection:
 *   - axis + thickness → `buildDefaultWallParams` (centered, χωρίς alignment).
 *   - entity build/validation → `buildWallEntity`.
 *   - containment → `isPointInPolygon` (`utils/geometry/GeometryUtils`).
 *
 * Ο πυρήνας `findRectanglesFromSegments` δουλεύει με corner-graph (μερτζάρει
 * κοντινά άκρα σε κόμβους, βρίσκει 4-κύκλους με ορθές γωνίες) → πιάνει και
 * στραμμένα ορθογώνια, όχι μόνο axis-aligned. Κοινός πυρήνας και για τους 3
 * τρόπους επιλογής (4 κλικ / 1 κλικ μέσα / box-select).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1K
 * @see ./wall-from-entity.ts (αδελφό bridge — on-entity Phase 1J)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isSpaceSeparatorEntity,
  isArcEntity,
  isCircleEntity,
  isEllipseEntity,
  isSplineEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { isPointInPolygon, arcToPolyline } from '../../utils/geometry/GeometryUtils';
// Reuse των ΚΑΝΟΝΙΚΩΝ tessellators (μηδέν νέος): arc/circle → arcToPolyline (ADR-166),
// ellipse/spline → trim SSoT. Έτσι τα καμπύλα όρια (τόξα/κύκλοι/τεταρτημόρια/καμπύλες)
// συμμετέχουν στην ανίχνευση περιοχής όπως οι ευθείες.
import { tessellateEllipse, tessellateSpline } from '../../systems/trim/trim-intersection-mapper';
import { REGION_FILL_MIN_WALL_LENGTH_MM, type WallEntity } from '../types/wall-types';
import {
  buildDefaultWallParams,
  buildWallEntity,
  type SceneUnits,
  type WallParamOverrides,
} from '../../hooks/drawing/wall-completion';
import { mmToSceneUnits } from '../../utils/scene-units';
import { projectPointTo2D } from '../geometry/shared/polygon-utils';

// ─── Public types ──────────────────────────────────────────────────────────

/** Μια ανεξάρτητη γραμμή υποψήφια ως πλευρά (id προαιρετικό — για highlight). */
export interface RegionLineSeg {
  readonly id?: string;
  readonly start: Point2D;
  readonly end: Point2D;
}

/** Ορθογώνιο που ανιχνεύτηκε — 4 κορυφές με σειρά + μετρικές. */
export interface DetectedRectangle {
  readonly polygon: readonly [Point2D, Point2D, Point2D, Point2D];
  /** Μεγάλη πλευρά (world/scene units) → μήκος τοίχου. */
  readonly longSide: number;
  /** Μικρή πλευρά (world/scene units) → πάχος τοίχου. */
  readonly shortSide: number;
  readonly area: number;
  /**
   * ADR-419 §T-junction — προαιρετικός ΡΗΤΟΣ άξονας (centerline endpoints, world units)
   * όταν η πηγή γνωρίζει τον προσανατολισμό (`decomposeWallsFromFootprint` H/V). Ο
   * `buildWallFillingRect` τον τιμά αντί για την ευριστική «μεγάλη πλευρά = άξονας» — ώστε
   * ένας **κοντός-χοντρός** τοίχος (μήκος < πάχος, π.χ. 5×10cm stub) να έχει άξονα ΚΑΘΕΤΟ
   * στον γείτονα (όχι παράλληλο). Απών → corner-graph fallback (μεγάλη πλευρά = άξονας).
   */
  readonly axis?: readonly [Point2D, Point2D];
}

// ─── Scene → candidate segments ──────────────────────────────────────────────

/** Επιλογές εξαγωγής τμημάτων. */
export interface ExtractLineSegmentsOptions {
  /**
   * Αν `true`, τα καμπύλα entities (ARC/CIRCLE/ELLIPSE/SPLINE) δειγματίζονται σε
   * τμήματα ώστε να συμμετέχουν στην ανίχνευση περιοχής (τόξα/κύκλοι/τεταρτημόρια/
   * καμπύλες ως όρια δωματίου). Default `false` → ΜΟΝΟ ευθείες (πλήρης μη-regression
   * για τον wall/thermal rectangle detector που θέλει μόνο ευθείες πλευρές).
   */
  readonly tessellateCurves?: boolean;
}

/** Σπάει μια αλυσίδα δειγματισμένων σημείων σε διαδοχικά τμήματα (closed → +κλείσιμο). */
function pushChainSegments(
  id: string | undefined,
  pts: readonly Point2D[],
  closed: boolean,
  out: RegionLineSeg[],
): void {
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ id, start: projectPointTo2D(pts[i]), end: projectPointTo2D(pts[i + 1]) });
  }
  if (closed) {
    const a = pts[pts.length - 1];
    const b = pts[0];
    out.push({ id, start: projectPointTo2D(a), end: projectPointTo2D(b) });
  }
}

/**
 * Όλα τα ευθύγραμμα τμήματα από scene entities που μπορούν να γίνουν πλευρές:
 * κάθε LINE (1 τμήμα) + κάθε ακμή ανοιχτού/κλειστού POLYLINE/LWPOLYLINE + (opt-in)
 * δειγματισμένα καμπύλα (ARC/CIRCLE/ELLIPSE/SPLINE). Κρατά το `id` της οντότητας
 * (για highlight των picked). Πηγή για τους τρόπους «1 κλικ μέσα» / «box-select»
 * και για τον auto-area room detector (με `tessellateCurves`).
 */
export function extractLineSegments(
  entities: readonly Entity[],
  options: ExtractLineSegmentsOptions = {},
): RegionLineSeg[] {
  const { tessellateCurves = false } = options;
  const segs: RegionLineSeg[] = [];
  for (const e of entities) {
    if (isLineEntity(e)) {
      segs.push({ id: e.id, start: projectPointTo2D(e.start), end: projectPointTo2D(e.end) });
      continue;
    }
    if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
      const verts = e.vertices;
      if (!verts || verts.length < 2) continue;
      const last = e.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < last; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        segs.push({ id: e.id, start: projectPointTo2D(a), end: projectPointTo2D(b) });
      }
      continue;
    }
    // ADR-437 — ο διαχωριστής χώρου (IfcVirtualElement) συμμετέχει στην ανίχνευση
    // περιοχής ΟΠΩΣ μια γραμμή: εκθέτει το 2-point segment του ώστε ο θερμικός χώρος
    // να κλείνει/υποδιαιρεί περιοχές πάνω σε διαχωριστές όπως πάνω σε τοίχους.
    if (isSpaceSeparatorEntity(e)) {
      const { start, end } = e.params;
      segs.push({ id: e.id, start: projectPointTo2D(start), end: projectPointTo2D(end) });
      continue;
    }
    // ── Καμπύλα όρια (opt-in) — reuse των κανονικών tessellators ──────────────
    if (!tessellateCurves) continue;
    if (isArcEntity(e)) {
      pushChainSegments(e.id, arcToPolyline(e), false, segs); // ανοιχτό τόξο/τεταρτημόριο
    } else if (isCircleEntity(e)) {
      pushChainSegments(e.id, arcToPolyline({ center: e.center, radius: e.radius, startAngle: 0, endAngle: 360 }), true, segs);
    } else if (isEllipseEntity(e)) {
      const span = Math.abs((e.endParam ?? Math.PI * 2) - (e.startParam ?? 0));
      const fullEllipse = span >= Math.PI * 2 - 1e-6;
      pushChainSegments(e.id, tessellateEllipse(e), fullEllipse, segs);
    } else if (isSplineEntity(e)) {
      pushChainSegments(e.id, tessellateSpline(e), e.closed === true, segs);
    }
  }
  return segs;
}

/** Πλησιέστερο τμήμα κάτω από το `point` εντός `tol` (ή `null`). */
export function pickSegmentAt(
  point: Readonly<Point2D>,
  segments: readonly RegionLineSeg[],
  tol: number,
): RegionLineSeg | null {
  let best: { dist: number; seg: RegionLineSeg } | null = null;
  for (const s of segments) {
    const d = pointToLineDistance(point, s.start, s.end);
    if (d <= tol && (!best || d < best.dist)) best = { dist: d, seg: s };
  }
  return best?.seg ?? null;
}

// ─── Corner-graph rectangle detection ────────────────────────────────────────

/** Μερτζάρει τα άκρα όλων των segments σε κόμβους εντός `tol`. */
function mergeNodes(
  segments: readonly RegionLineSeg[],
  tol: number,
): { nodes: Point2D[]; edges: Array<[number, number]> } {
  const nodes: Point2D[] = [];
  const indexOf = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      if (Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) <= tol) return i;
    }
    nodes.push(projectPointTo2D(p));
    return nodes.length - 1;
  };
  const edges: Array<[number, number]> = [];
  for (const s of segments) {
    const a = indexOf(s.start);
    const b = indexOf(s.end);
    if (a !== b) edges.push([a, b]);
  }
  return { nodes, edges };
}

/** Λίστα γειτνίασης κόμβων (αμφίδρομη) από τις ακμές. */
function buildAdjacency(nodeCount: number, edges: Array<[number, number]>): Set<number>[] {
  const adj: Set<number>[] = Array.from({ length: nodeCount }, () => new Set<number>());
  for (const [a, b] of edges) {
    adj[a].add(b);
    adj[b].add(a);
  }
  return adj;
}

/** Γωνία στο `b` ανάμεσα στα διανύσματα b→a και b→c είναι ~90°; */
function isRightAngle(a: Point2D, b: Point2D, c: Point2D, cosTol: number): boolean {
  const u = { x: a.x - b.x, y: a.y - b.y };
  const v = { x: c.x - b.x, y: c.y - b.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  if (lu < 1e-9 || lv < 1e-9) return false;
  return Math.abs((u.x * v.x + u.y * v.y) / (lu * lv)) <= cosTol;
}

/** Επικύρωση + κατασκευή ορθογωνίου από 4 κόμβους σε σειρά A→B→C→D. */
function rectFromCorners(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  tol: number,
  cosTol: number,
): DetectedRectangle | null {
  // Τρεις ορθές γωνίες ⇒ η τέταρτη προκύπτει· επιβεβαιώνουμε και τις 3.
  if (!isRightAngle(d, a, b, cosTol)) return null;
  if (!isRightAngle(a, b, c, cosTol)) return null;
  if (!isRightAngle(b, c, d, cosTol)) return null;
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const cd = Math.hypot(d.x - c.x, d.y - c.y);
  const da = Math.hypot(a.x - d.x, a.y - d.y);
  if (Math.abs(ab - cd) > tol || Math.abs(bc - da) > tol) return null; // opposite sides equal
  if (ab < tol || bc < tol) return null; // degenerate
  return {
    polygon: [a, b, c, d],
    longSide: Math.max(ab, bc),
    shortSide: Math.min(ab, bc),
    area: ab * bc,
  };
}

/**
 * Βρίσκει ΟΛΑ τα διακριτά ορθογώνια που σχηματίζονται από 4 segments του συνόλου
 * (κοινά άκρα + ορθές γωνίες). Dedup με κανονικό κλειδί ταξινομημένων κόμβων.
 */
export function findRectanglesFromSegments(
  segments: readonly RegionLineSeg[],
  tol: number,
): DetectedRectangle[] {
  const { nodes, edges } = mergeNodes(segments, tol);
  const adj = buildAdjacency(nodes.length, edges);
  const cosTol = 0.08; // ~±4.6° ανοχή ορθής γωνίας
  const found = new Map<string, DetectedRectangle>();
  for (let a = 0; a < nodes.length; a++) {
    for (const b of adj[a]) {
      if (b <= a) continue; // a = ελάχιστος δείκτης (αποφυγή διπλών)
      for (const c of adj[b]) {
        if (c === a || c <= a) continue;
        for (const d of adj[c]) {
          if (d === a || d === b || d <= a || !adj[d].has(a)) continue;
          const rect = rectFromCorners(nodes[a], nodes[b], nodes[c], nodes[d], tol, cosTol);
          if (!rect) continue;
          const key = [a, b, c, d].sort((x, y) => x - y).join('-');
          if (!found.has(key)) found.set(key, rect);
        }
      }
    }
  }
  return [...found.values()];
}

/**
 * Το ΜΙΚΡΟΤΕΡΟ (κατά εμβαδό) ορθογώνιο που περικλείει το `point`. Για τον τρόπο
 * «1 κλικ μέσα στην περιοχή» — αν υπάρχουν εμφωλευμένα ορθογώνια, διαλέγει το
 * πιο εσωτερικό. `null` αν κανένα δεν περιέχει το σημείο.
 */
export function findEnclosingRectangle(
  segments: readonly RegionLineSeg[],
  point: Readonly<Point2D>,
  tol: number,
): DetectedRectangle | null {
  const rects = findRectanglesFromSegments(segments, tol).filter((r) =>
    isPointInPolygon(point as Point2D, [...r.polygon]),
  );
  if (rects.length === 0) return null;
  return rects.reduce((a, b) => (b.area < a.area ? b : a));
}

// ─── Filling-wall builder (reuse SSoT) ────────────────────────────────────────

/** Μέσο σημείο δύο κορυφών. */
function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * ΕΝΑΣ γεμάτος τοίχος που γεμίζει το ορθογώνιο. Ο άξονας τρέχει παράλληλα στη
 * ΜΕΓΑΛΗ πλευρά, κεντραρισμένος ανάμεσα στις δύο μεγάλες πλευρές → μήκος = μεγάλη
 * πλευρά, πάχος = μικρή πλευρά, αποτύπωμα = όλο το ορθογώνιο.
 *
 * Το πάχος (μικρή πλευρά σε scene units) μετατρέπεται σε mm για το `thickness`
 * override (ο builder ξανα-μετατρέπει mm→scene στο `computeWallGeometry`).
 * Επιστρέφει `null` αν ο validator απορρίψει.
 */
/** Κεντρική γραμμή (άξονας) + μήκος/πάχος ενός `DetectedRectangle` (world units). */
export interface DetectedRectAxis {
  readonly start: Point2D;
  readonly end: Point2D;
  /** Μήκος τοίχου = απόσταση άξονα. */
  readonly length: number;
  /** Πάχος τοίχου = κάθετη διάσταση. */
  readonly thickness: number;
}

/**
 * SSoT — ο άξονας (centerline) + μήκος/πάχος ενός ανιχνευμένου ορθογωνίου.
 *
 * Αν το rect φέρει ΡΗΤΟ `axis` (από `decomposeWallsFromFootprint`, γνωστός H/V
 * προσανατολισμός) → τον τιμά (μήκος = |axis|, πάχος = area/μήκος). Αλλιώς (corner-graph)
 * → ευριστική «μεγάλη πλευρά = άξονας». Έτσι ένας κοντός-χοντρός stub (μήκος < πάχος)
 * κρατά άξονα ΚΑΘΕΤΟ στον γείτονα (Giorgio 2026-07-03) και preview ≡ commit
 * (`resolvePerimeterPreview` και `buildWallFillingRect` μοιράζονται ΑΥΤΟΝ τον υπολογισμό).
 */
export function detectedRectAxis(rect: DetectedRectangle): DetectedRectAxis {
  const [a, b, c, d] = rect.polygon;
  const abLen = Math.hypot(b.x - a.x, b.y - a.y);
  const bcLen = Math.hypot(c.x - b.x, c.y - b.y);
  if (rect.axis) {
    const start = projectPointTo2D(rect.axis[0]);
    const end = projectPointTo2D(rect.axis[1]);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    return { start, end, length, thickness: length > 1e-9 ? rect.area / length : Math.min(abLen, bcLen) };
  }
  if (abLen >= bcLen) {
    return { start: midpoint(d, a), end: midpoint(b, c), length: abLen, thickness: bcLen };
  }
  return { start: midpoint(a, b), end: midpoint(c, d), length: bcLen, thickness: abLen };
}

/**
 * Αποτέλεσμα του `buildWallFillingRectResult`: είτε ο γεμάτος τοίχος, είτε ο ΛΟΓΟΣ
 * απόρριψης (validator hardError i18n key) ώστε το preview («μία διαδρομή δημιουργίας»,
 * ADR-419 v2.4) να δείχνει κόκκινο + tooltip αντί απλώς να αποκρύπτει το rect.
 */
export type FillingRectBuild =
  | { readonly ok: true; readonly wall: WallEntity }
  | { readonly ok: false; readonly reason: string };

/**
 * ΕΝΑΣ γεμάτος τοίχος από ένα `DetectedRectangle`, ΚΡΑΤΩΝΤΑΣ τον λόγο απόρριψης όταν
 * ο validator τον κόβει (μήκος/πάχος/ύψος). SSoT build path — ίδιο math με τον commit·
 * ο `buildWallFillingRect` (null wrapper) και το `computeFillingWalls` (rejected reasons)
 * καλούν ΑΥΤΟΝ ώστε preview ≡ commit 100%.
 */
export function buildWallFillingRectResult(
  rect: DetectedRectangle,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
): FillingRectBuild {
  const { start: axisStart, end: axisEnd, thickness: shortSideWorld } = detectedRectAxis(rect);
  const thicknessMm = shortSideWorld / mmToSceneUnits(sceneUnits);
  const params = buildDefaultWallParams(
    axisStart,
    axisEnd,
    { ...overrides, thickness: thicknessMm },
    sceneUnits,
  );
  // ADR-419 §region-tolerance — region-fill: κάθε rect είναι πραγματική εντοπισμένη
  // γεωμετρία (όχι degenerate κλικ), οπότε το freehand `MIN_WALL_LENGTH_MM=100` δεν
  // ισχύει· χρησιμοποιούμε το degenerate floor ώστε κοντά στελέχη (π.χ. κεφαλή Τ μετά
  // το junction-split) να ΔΗΜΙΟΥΡΓΟΥΝΤΑΙ αντί να απορρίπτονται (Giorgio 2026-07-03).
  const result = buildWallEntity(params, levelId, 'straight', sceneUnits, {
    minLengthMm: REGION_FILL_MIN_WALL_LENGTH_MM,
  });
  if (result.ok) return { ok: true, wall: result.entity };
  return { ok: false, reason: result.hardErrors[0] ?? 'wall.validation.hardErrors.lengthTooShort' };
}

export function buildWallFillingRect(
  rect: DetectedRectangle,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
): WallEntity | null {
  const build = buildWallFillingRectResult(rect, overrides, sceneUnits, levelId);
  return build.ok ? build.wall : null;
}
