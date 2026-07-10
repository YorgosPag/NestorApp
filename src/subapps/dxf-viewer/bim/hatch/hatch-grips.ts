/**
 * ADR-507 — Hatch parametric grip handlers.
 *
 * Pure functions (zero React / DOM / Firestore / canvas deps). Mirror of
 * `bim/floor-finishes/floor-finish-grips.ts`, but the hatch is a FLAT primitive
 * (`boundaryPaths: Point2D[][]`, NO params/geometry):
 *
 *   - `hatch-vertex-${pathIdx}-${vertexIdx}` → translate boundary vertex
 *     (path 0 = outer ring, rest = island rings). XY only.
 *
 * Edge-midpoint insertion = DEFER (separate slice). Rectilinear constraint:
 * when `input.rectilinear` is true the delta is quantized to the dominant world
 * axis (Ortho / Shift-constrained), same as floor-finish.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchGripKind } from '../../hooks/grip-types';
import { constrainDeltaToDominantAxis } from '../grips/ortho-delta';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';

const VERTEX_PREFIX = 'hatch-vertex-';
const EDGE_MIDPOINT_PREFIX = 'hatch-edge-midpoint-';

/** Minimum vertices a boundary ring must keep (a polygon degenerates below a triangle). */
const MIN_RING_VERTICES = 3;

/** A boundary-vertex grip target: ring + vertex indices (→ `hatch-vertex-${pathIdx}-${vertexIdx}`) + world point. */
export interface HatchBoundaryGrip {
  readonly pathIdx: number;
  readonly vertexIdx: number;
  readonly point: Point2D;
}

/** An edge-midpoint grip target: ring + edge indices (→ `hatch-edge-midpoint-${pathIdx}-${edgeIdx}`) + world midpoint. */
export interface HatchEdgeMidpointGrip {
  readonly pathIdx: number;
  readonly edgeIdx: number;
  readonly point: Point2D;
}

/**
 * ADR-507 §grip-SSoT (Giorgio 2026-07-07, big-player) — THE single source for "where are a
 * hatch's boundary-vertex grips". Both the VISIBLE grips (`HatchRenderer.getGrips`) and the
 * INTERACTION grips (`computeDxfEntityGrips` case 'hatch') derive their per-vertex grips from
 * HERE, so the two sets can NEVER diverge again. Previously each ran its OWN `boundaryPaths`
 * loop — the duplication that let «visible ≠ pickable» drift (one path got capped, the other
 * did not → grips you could see but not grab). Order = path-major, vertex-minor: the array
 * index IS the running `gripIndex` both consumers assign, kept 1-to-1 (render ≡ interaction).
 */
export function getHatchBoundaryGrips(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): HatchBoundaryGrip[] {
  const grips: HatchBoundaryGrip[] = [];
  boundaryPaths.forEach((path, pathIdx) => {
    path.forEach((v, vertexIdx) => {
      grips.push({ pathIdx, vertexIdx, point: { x: v.x, y: v.y } });
    });
  });
  return grips;
}

/**
 * ADR-507 (Giorgio 2026-07-07) — THE single source for a hatch's edge-midpoint grips
 * (one per ring edge). Both the VISIBLE grips (`HatchRenderer.getGrips`) and the
 * INTERACTION grips (`computeDxfEntityGrips` case 'hatch') iterate THIS in the SAME order,
 * appended right after the vertex grips → display ≡ interaction (gripIndex stays 1-to-1).
 * Clicking/dragging one inserts a new boundary vertex there (mirror of floor-finish/slab).
 * Degenerate rings (<3 vertices) contribute no edge-midpoint grips.
 */
export function getHatchEdgeMidpointGrips(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): HatchEdgeMidpointGrip[] {
  const grips: HatchEdgeMidpointGrip[] = [];
  boundaryPaths.forEach((ring, pathIdx) => {
    if (ring.length < MIN_RING_VERTICES) return;
    ring.forEach((a, edgeIdx) => {
      const b = ring[(edgeIdx + 1) % ring.length];
      grips.push({ pathIdx, edgeIdx, point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    });
  });
  return grips;
}

/** Grip kind για το gradient origin/seed (ADR-507 Φ5 A3). */
export const HATCH_GRADIENT_ORIGIN_KIND = 'hatch-gradient-origin' as const;

/** Grip kind για τον gradient-angle βραχίονα (ADR-507 Φ5 A4). */
export const HATCH_GRADIENT_ANGLE_KIND = 'hatch-gradient-angle' as const;

/** ADR-627 — grip kind για τον σταυρό μετακίνησης ολόκληρου του hatch (parity polyline). */
export const HATCH_MOVE_KIND = 'hatch-move' as const;

/** ADR-627 — grip kind για τη λαβή περιστροφής ολόκληρου του hatch (parity polyline). */
export const HATCH_ROTATION_KIND = 'hatch-rotation' as const;

/** True όταν το grip kind είναι ο σταυρός μετακίνησης ολόκληρου του hatch (ADR-627). */
export function isHatchMoveKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_MOVE_KIND;
}

/** True όταν το grip kind είναι η λαβή περιστροφής ολόκληρου του hatch (ADR-627). */
export function isHatchRotationKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_ROTATION_KIND;
}

export interface HatchGripDragInput {
  readonly originalBoundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>;
  readonly delta: Point2D;
  readonly rectilinear?: boolean;
}

/** True όταν το grip kind είναι το gradient origin (όχι boundary vertex). */
export function isHatchOriginGripKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_GRADIENT_ORIGIN_KIND;
}

/** True όταν το grip kind είναι ο gradient-angle βραχίονας (ADR-507 Φ5 A4). */
export function isHatchAngleGripKind(gripKind: HatchGripKind): boolean {
  return gripKind === HATCH_GRADIENT_ANGLE_KIND;
}

/** Axis-aligned bounding box των boundaryPaths· `null` σε κενό όριο. */
export interface HatchBounds {
  readonly minX: number; readonly minY: number;
  readonly maxX: number; readonly maxY: number;
}

/**
 * SSoT bounding-box των boundaryPaths. Το μοιράζονται η προεπιλεγμένη θέση του
 * gradient origin (`hatchBoundsCenter`) και ο `HatchRenderer.fillGradient`
 * (center + extent) → ΜΙΑ bbox math, μηδέν διπλότυπο.
 */
export function hatchBounds(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): HatchBounds | null {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const path of boundaryPaths) {
    for (const v of path) {
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    }
  }
  if (!Number.isFinite(minX) || maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Κέντρο bbox των boundaryPaths — η **προεπιλεγμένη** θέση του gradient origin
 * (όταν `patternOrigin` απών). Επιστρέφει `null` σε κενό/εκφυλισμένο όριο.
 */
export function hatchBoundsCenter(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): Point2D | null {
  const b = hatchBounds(boundaryPaths);
  return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
}

/**
 * Pure transform: gradient origin + drag delta → νέο origin (Point2D). Rectilinear
 * (Shift/Ortho) → quantize στον κυρίαρχο άξονα, ίδιο με τη boundary λαβή. Δεν
 * μεταλλάσσει το input.
 */
export function applyHatchOriginGripDrag(
  originalOrigin: Point2D,
  input: Readonly<Pick<HatchGripDragInput, 'delta' | 'rectilinear'>>,
): Point2D {
  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  return translatePoint(originalOrigin, delta);
}

/**
 * Ακτίνα (world) του gradient-angle βραχίονα = μισή διαγώνιος του bbox. Ανεξάρτητη από
 * τύπο gradient (linear/radial) — ο βραχίονας δηλώνει ΦΟΡΑ, όχι έκταση → ίδιος κανόνας
 * για όλους. Καθαρή ποσότητα (όχι το linear `half` του fillGradient → μηδέν διπλότυπο).
 */
function hatchGradientArmRadius(b: HatchBounds): number {
  return 0.5 * Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
}

/**
 * Θέση (world) της gradient-angle λαβής: `origin + R·(cosθ, sinθ)` όπου θ=`angleDeg`
 * (world convention, ίδιο με `fillGradient`) και R = `hatchGradientArmRadius`. `null` σε
 * εκφυλισμένο bbox. ΜΙΑ SSoT θέση — μοιράζεται DISPLAY (`HatchRenderer.getGrips`) +
 * INTERACTION (`computeDxfEntityGrips`) + drag math (anchor = αυτή η θέση).
 */
export function hatchGradientAngleGripPos(
  origin: Point2D,
  angleDeg: number,
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
): Point2D | null {
  const b = hatchBounds(boundaryPaths);
  if (!b) return null;
  const R = hatchGradientArmRadius(b);
  if (!(R > 0)) return null;
  const r = (angleDeg * Math.PI) / 180;
  return { x: origin.x + Math.cos(r) * R, y: origin.y + Math.sin(r) * R };
}

/** Βήμα snap (μοίρες) όταν ο χρήστης κρατά Shift — AutoCAD/Revit «ortho» για τη γωνία. */
export const HATCH_ANGLE_SNAP_DEG = 15;

/**
 * Pure transform: gradient origin + ΖΩΝΤΑΝΗ θέση λαβής (cursor world = anchor + delta) →
 * νέα γωνία σε **μοίρες** [0,360). `atan2` σε WORLD coords (η `angleDeg` είναι world
 * convention όπως ο `fillGradient`) → μηδέν canvas-Y σύγχυση. Όταν `snap` (Shift), η γωνία
 * κουμπώνει σε βήματα `HATCH_ANGLE_SNAP_DEG`. Δεν μεταλλάσσει το input.
 */
export function applyHatchAngleGripDrag(
  origin: Point2D,
  cursorWorld: Point2D,
  snap: boolean = false,
): number {
  const raw = (Math.atan2(cursorWorld.y - origin.y, cursorWorld.x - origin.x) * 180) / Math.PI;
  const deg = normalizeAngleDeg(raw);
  if (!snap) return deg;
  return (Math.round(deg / HATCH_ANGLE_SNAP_DEG) * HATCH_ANGLE_SNAP_DEG) % 360;
}

/** Decode a `hatch-*-${a}-${b}` grip kind (given its prefix) → `[a, b]` or `null`. */
function decodeTwoIndexGripKind(gripKind: HatchGripKind, prefix: string): [number, number] | null {
  if (!gripKind.startsWith(prefix)) return null;
  const rest = gripKind.slice(prefix.length).split('-');
  if (rest.length !== 2) return null;
  const a = parseInt(rest[0], 10);
  const b = parseInt(rest[1], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return null;
  return [a, b];
}

/** Decode `hatch-vertex-${pathIdx}-${vertexIdx}` → `[pathIdx, vertexIdx]` or `null`. */
export function decodeHatchVertexGripKind(gripKind: HatchGripKind): [number, number] | null {
  return decodeTwoIndexGripKind(gripKind, VERTEX_PREFIX);
}

/** Decode `hatch-edge-midpoint-${pathIdx}-${edgeIdx}` → `[pathIdx, edgeIdx]` or `null`. */
export function decodeHatchEdgeMidpointGripKind(gripKind: HatchGripKind): [number, number] | null {
  return decodeTwoIndexGripKind(gripKind, EDGE_MIDPOINT_PREFIX);
}

/**
 * Pure: insert a NEW boundary vertex on edge `[edgeIdx, edgeIdx+1]` of ring `pathIdx`,
 * at the edge midpoint + `delta`. Returns the ORIGINAL array reference on out-of-range
 * (no-op signal). Shared by the edge-midpoint drag (`applyHatchGripDrag`) AND the grip
 * context-menu «Add vertex» (`buildHatchVertexOpCommand`, delta 0) — one insertion SSoT.
 */
export function insertHatchVertexOnEdge(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
  pathIdx: number,
  edgeIdx: number,
  delta: Point2D,
): Point2D[][] {
  if (pathIdx < 0 || pathIdx >= boundaryPaths.length) return boundaryPaths as Point2D[][];
  const ring = boundaryPaths[pathIdx];
  if (edgeIdx < 0 || edgeIdx >= ring.length) return boundaryPaths as Point2D[][];
  const a = ring[edgeIdx];
  const b = ring[(edgeIdx + 1) % ring.length];
  const inserted: Point2D = { x: (a.x + b.x) / 2 + delta.x, y: (a.y + b.y) / 2 + delta.y };
  return boundaryPaths.map((r, p) => {
    if (p !== pathIdx) return projectVerticesTo2D(r);
    const next: Point2D[] = [];
    r.forEach((v, i) => {
      next.push({ x: v.x, y: v.y });
      if (i === edgeIdx) next.push(inserted);
    });
    return next;
  });
}

/**
 * Pure: remove boundary vertex `vertexIdx` from ring `pathIdx`. Guard: returns the
 * ORIGINAL array reference (no-op signal) when the ring is already at the minimum
 * triangle (≤3 vertices) or the index is out of range — callers detect via identity.
 */
export function removeVertexFromHatch(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
  pathIdx: number,
  vertexIdx: number,
): Point2D[][] {
  if (pathIdx < 0 || pathIdx >= boundaryPaths.length) return boundaryPaths as Point2D[][];
  const ring = boundaryPaths[pathIdx];
  if (ring.length <= MIN_RING_VERTICES) return boundaryPaths as Point2D[][];
  if (vertexIdx < 0 || vertexIdx >= ring.length) return boundaryPaths as Point2D[][];
  return boundaryPaths.map((r, p) =>
    p === pathIdx
      ? r.filter((_, i) => i !== vertexIdx).map((v) => ({ x: v.x, y: v.y }))
      : projectVerticesTo2D(r),
  );
}

/** A boundary-vertex delete target: which ring + which vertex. */
export interface HatchVertexTarget {
  readonly pathIdx: number;
  readonly vertexIdx: number;
}

/**
 * Pure: remove MANY boundary vertices at once (bulk Delete of armed/selected grips).
 * Per ring, removes the requested vertices in descending index order but STOPS at the
 * minimum triangle — a ring never drops below 3 vertices (removes as many as it can).
 * Returns the ORIGINAL array reference (no-op signal) when nothing could be removed.
 * Shared by the armed-grip bulk delete (`buildArmedHatchVertexDeleteCommand`).
 */
export function removeVerticesFromHatch(
  boundaryPaths: ReadonlyArray<ReadonlyArray<Point2D>>,
  targets: ReadonlyArray<HatchVertexTarget>,
): Point2D[][] {
  const byRing = new Map<number, number[]>();
  for (const t of targets) {
    if (t.pathIdx < 0 || t.pathIdx >= boundaryPaths.length) continue;
    const list = byRing.get(t.pathIdx) ?? [];
    list.push(t.vertexIdx);
    byRing.set(t.pathIdx, list);
  }
  let changed = false;
  const next = boundaryPaths.map((ring, p) => {
    const idxs = byRing.get(p);
    const result: Point2D[] = ring.map((v) => ({ x: v.x, y: v.y }));
    if (!idxs || idxs.length === 0) return result;
    // Unique, in-range, descending → splicing a higher index never shifts a lower one.
    const sorted = [...new Set(idxs)].filter((i) => i >= 0 && i < ring.length).sort((a, b) => b - a);
    for (const i of sorted) {
      if (result.length <= MIN_RING_VERTICES) break; // keep the minimum triangle
      result.splice(i, 1);
      changed = true;
    }
    return result;
  });
  return changed ? next : (boundaryPaths as Point2D[][]);
}

/**
 * Pure transform: hatch grip kind + drag input → new `boundaryPaths`. Returns the
 * ORIGINAL array reference unchanged on out-of-range index or zero delta (no-op
 * signal the caller short-circuits on). Never mutates the input.
 */
export function applyHatchGripDrag(
  gripKind: HatchGripKind,
  input: Readonly<HatchGripDragInput>,
): Point2D[][] {
  const original = input.originalBoundaryPaths;

  // Edge-midpoint grip → insert a new vertex at the edge midpoint + delta (always a
  // real edit, even at delta 0 → the fresh vertex appears the moment the drag starts).
  const edge = decodeHatchEdgeMidpointGripKind(gripKind);
  if (edge) {
    const d = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
    return insertHatchVertexOnEdge(original, edge[0], edge[1], d);
  }

  const decoded = decodeHatchVertexGripKind(gripKind);
  if (!decoded) return original as Point2D[][];
  const [pathIdx, vertexIdx] = decoded;
  if (pathIdx >= original.length) return original as Point2D[][];
  const path = original[pathIdx];
  if (vertexIdx >= path.length) return original as Point2D[][];

  const delta = input.rectilinear ? constrainDeltaToDominantAxis(input.delta) : input.delta;
  if (delta.x === 0 && delta.y === 0) return original as Point2D[][];

  // Clone only the affected ring; share the untouched rings by reference.
  return original.map((ring, p) =>
    p === pathIdx
      ? ring.map((v, i) => (i === vertexIdx ? translatePoint(v, delta) : { x: v.x, y: v.y }))
      : projectVerticesTo2D(ring),
  );
}
