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
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import type { WallEntity } from '../types/wall-types';
import {
  buildDefaultWallParams,
  buildWallEntity,
  type SceneUnits,
  type WallParamOverrides,
} from '../../hooks/drawing/wall-completion';
import { mmToSceneUnits } from '../../utils/scene-units';
import { REGION_PERIMETER_LIMITS } from '../../config/tolerance-config';

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
}

// ─── Scene → candidate segments ──────────────────────────────────────────────

/**
 * Όλα τα ευθύγραμμα τμήματα από scene entities που μπορούν να γίνουν πλευρές:
 * κάθε LINE (1 τμήμα) + κάθε ακμή ανοιχτού/κλειστού POLYLINE/LWPOLYLINE. Κρατά
 * το `id` της οντότητας (για highlight των picked). Πηγή για τους τρόπους «1
 * κλικ μέσα» και «box-select».
 */
export function extractLineSegments(entities: readonly Entity[]): RegionLineSeg[] {
  const segs: RegionLineSeg[] = [];
  for (const e of entities) {
    if (isLineEntity(e)) {
      segs.push({ id: e.id, start: { x: e.start.x, y: e.start.y }, end: { x: e.end.x, y: e.end.y } });
      continue;
    }
    if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
      const verts = e.vertices;
      if (!verts || verts.length < 2) continue;
      const last = e.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < last; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        segs.push({ id: e.id, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } });
      }
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
    nodes.push({ x: p.x, y: p.y });
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
export function buildWallFillingRect(
  rect: DetectedRectangle,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
): WallEntity | null {
  const [a, b, c, d] = rect.polygon;
  const abLen = Math.hypot(b.x - a.x, b.y - a.y);
  const bcLen = Math.hypot(c.x - b.x, c.y - b.y);
  // Άξονας στη μεσοκάθετο ανάμεσα στις δύο ΜΕΓΑΛΕΣ πλευρές· πάχος = μικρή πλευρά.
  let axisStart: Point2D;
  let axisEnd: Point2D;
  let shortSideWorld: number;
  if (abLen >= bcLen) {
    // AB/CD μεγάλες → άξονας midpoint(D,A) → midpoint(B,C), πάχος = BC.
    axisStart = midpoint(d, a);
    axisEnd = midpoint(b, c);
    shortSideWorld = bcLen;
  } else {
    // BC/DA μεγάλες → άξονας midpoint(A,B) → midpoint(C,D), πάχος = AB.
    axisStart = midpoint(a, b);
    axisEnd = midpoint(c, d);
    shortSideWorld = abLen;
  }
  const thicknessMm = shortSideWorld / mmToSceneUnits(sceneUnits);
  // ADR-419 Layer 4 (net) — reject ορθογώνιο με πάχος πάνω από λογικό δομικό μέλος
  // (π.χ. το εξωτερικό περίγραμμα του σχεδίου). Ελέγχεται ΜΟΝΟ η μικρή πλευρά →
  // legit μακρύς τοίχος (10m × 0.2m) περνά.
  if (thicknessMm > REGION_PERIMETER_LIMITS.MAX_MEMBER_THICKNESS_MM) return null;
  const params = buildDefaultWallParams(
    axisStart,
    axisEnd,
    { ...overrides, thickness: thicknessMm },
    sceneUnits,
  );
  const result = buildWallEntity(params, levelId, 'straight', sceneUnits);
  return result.ok ? result.entity : null;
}
