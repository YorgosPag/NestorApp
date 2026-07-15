/**
 * ADR-366 §A.3 Q3 Phase 7.0B — Pure intersection math για 2D Section Panel.
 *
 * Computes πού ένα κάθετο cutting plane τέμνει τα Nestor BIM elements
 * (wall/column/beam/slab/opening) και επιστρέφει 2D rects στο "section space"
 * (h = perpendicular coord σε meters, y = vertical world Y σε meters).
 *
 * Port από `C:\genarc\src\engines\viewport\sectionIntersect.ts` (189 LOC,
 * PORT_WITH_ADAPTATION per SPEC-3D-004A §3.2) με:
 *   - type swap GenArc Wall/Column/Beam/Slab/Opening → Nestor entities
 *   - unit conversion mm → m on vertical extents (Nestor convention)
 *   - axis 'z' → 'y' rename (Nestor 2D plan uses y for north, not GenArc z)
 *   - extraction adapter helpers (toWallPlan/toColumnPlan/...) — keep math pure
 *
 * SECTION COORDINATE SYSTEM (Phase 7.0B vertical cuts only):
 *   axis='x' → cutting line at constant Nestor plan x → perpendicular coord = y
 *   axis='y' → cutting line at constant Nestor plan y → perpendicular coord = x
 *
 * @see SPEC-3D-004A §3.2 — GenArc port reference
 * @see ADR-366 §A.3 Q3 — 2D Section Panel decision
 */

import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import {
  resolveWallTopProfile,
  evaluateWallTopAt,
  type WallTopProfile,
  type HostUndersidePlan,
  type HostTopsidePlan,
} from '../../bim/geometry/wall-top-profile';
import {
  resolveWallBaseProfile,
  evaluateWallBaseAt,
  type WallBaseProfile,
} from '../../bim/geometry/wall-base-profile';
import { slabSlopeOffsetZmm, type SlabPlanPoint } from '../../bim/geometry/slab-slope';
import { beamSlopeOffsetZmm, isBeamTilted, type BeamPlanPoint } from '../../bim/geometry/beam-slope';
import { columnCutPlaneShiftMm, wallCutPlaneShiftMm } from '../../bim/geometry/cut-plane-tilt';
import { mmToSceneUnits } from '../../utils/scene-units';
import { clamp01 } from '../../rendering/entities/shared/geometry-utils';

const MM_TO_M = 0.001;

/** Vertical-cut axis. 'x' = constant plan x; 'y' = constant plan y. */
export type SectionAxis = 'x' | 'y';

/**
 * 2D rect στο section space.
 *   - hMin/hMax: perpendicular coord (m, world meters)
 *   - yMin/yMax: vertical world Y (m, height above project origin)
 */
export interface SectionRect {
  readonly hMin: number;
  readonly hMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

// ─── Plan-space adapter inputs (m everywhere) ────────────────────────────────

export interface WallPlan {
  readonly id: string;
  readonly sx: number; readonly sy: number;
  readonly ex: number; readonly ey: number;
  readonly thicknessM: number;
  /** Nominal/minimum base (m) — back-compat scalar (= `baseProfile.minBaseZmm`). */
  readonly baseY: number;
  /** Nominal/maximum top (m) — back-compat scalar (= `topProfile.maxTopZmm`). */
  readonly topY: number;
  /**
   * ADR-401 Phase B: πλήρες προφίλ κορυφής (absolute mm). Παρόν πάντα· για
   * `attached` τοίχους με hosts είναι σκαλωτό/κεκλιμένο. Η `wallSection`
   * αποτιμά το προφίλ στο σημείο της τομής (single-point top).
   */
  readonly topProfile?: WallTopProfile;
  /**
   * ADR-401 (γ): πλήρες προφίλ **βάσης** (absolute mm). Για `attached` βάση με
   * hosts είναι σκαλωτό/κεκλιμένο (upper-envelope)· αλλιώς flat στο nominal. Η
   * `wallSection` το αποτιμά στο σημείο της τομής (single-point base → `yMin`).
   */
  readonly baseProfile?: WallBaseProfile;
}

export interface ColumnPlan {
  readonly id: string;
  /** Footprint polygon στο XY plane (m). Closed CCW. */
  readonly footprint: readonly (readonly [number, number])[];
  readonly baseY: number;
  readonly topY: number;
}

export interface BeamPlan {
  readonly id: string;
  /** Beam outline στο plan view (m). Closed CCW polygon. */
  readonly outline: readonly (readonly [number, number])[];
  /** Nominal κάτω/πάνω παρειά (m) — οριζόντια δοκός ή στάθμη στο startPoint. */
  readonly bottomY: number;
  readonly topY: number;
  /**
   * ADR-401 Phase E/(β): για κεκλιμένη δοκό (`topElevationEnd` ≠ `topElevation`),
   * αποτιμά την κεκλιμένη πάνω/κάτω παρειά (world m) σε plan-point. Η `beamSection`
   * το καλεί στο σημείο της τομής (single-point, mirror `slabSection`/`wallSection`).
   * Απών για οριζόντια δοκό → flat `bottomY`/`topY`.
   */
  readonly slopeYAt?: (pt: BeamPlanPoint) => { bottomY: number; topY: number };
}

export interface SlabPlan {
  readonly id: string;
  /** Slab outline στο XY plane (m). Closed CCW. */
  readonly outline: readonly (readonly [number, number])[];
  /** Nominal κάτω/πάνω παρειά (m) — επίπεδη ή pivot-level της κεκλιμένης. */
  readonly bottomY: number;
  readonly topY: number;
  /**
   * ADR-401 Phase E2 / ADR-369 §9 Q7: για `geometryType='tilted'` πλάκα/στέγη,
   * αποτιμά την κεκλιμένη πάνω/κάτω παρειά (world m) σε plan-point. Η `slabSection`
   * το καλεί στο σημείο της τομής (single-point, mirror `wallSection`). Απών για
   * επίπεδη πλάκα → flat `bottomY`/`topY`.
   */
  readonly slopeYAt?: (pt: SlabPlanPoint) => { bottomY: number; topY: number };
}

export interface OpeningPlan {
  readonly id: string;
  readonly wallId: string;
  /** Footprint quad (m) στο plan view — κατά μήκος του host wall axis. */
  readonly quad: readonly (readonly [number, number])[];
  readonly sillY: number;
  readonly headY: number;
}

// ─── Adapter: Nestor entities → plan-space inputs ────────────────────────────

/**
 * Convert WallEntity → plan-space input. `floorElevationM` provides the level
 * FFL for storey-relative base/top binding (defaults to 0).
 *
 * ADR-401 Phase B: η κάθετη επίλυση delegate-άρει στον SSoT `wall-top-profile`
 * resolver. Όταν δοθεί `resolveHost` (host context από beams/slabs), οι
 * `attached` τοίχοι παίρνουν **πλήρες προφίλ** (σκαλωτό/κεκλιμένο)· χωρίς host
 * context → nominal single-segment (back-compat με storey-ceiling/absolute/
 * unconnected). `topY` = `maxTopZmm` (back-compat scalar).
 *
 * ADR-401 (γ): `resolveHostTopside` (host **άνω**-παρειές) → base-attach προφίλ.
 * `baseY` = `minBaseZmm` (χαμηλότερη βάση· back-compat = nominal όταν μη-attached).
 */
export function toWallPlan(
  wall: WallEntity,
  floorElevationM = 0,
  resolveHost?: (id: string) => HostUndersidePlan | null,
  resolveHostTopside?: (id: string) => HostTopsidePlan | null,
  cutPlaneMm = 0,
): WallPlan {
  const ctx = { floorElevationMm: floorElevationM / MM_TO_M, resolveHost, resolveHostTopside };
  const topProfile = resolveWallTopProfile(wall.params, ctx);
  const baseProfile = resolveWallBaseProfile(wall.params, ctx);
  // ADR-404 Phase 3 — section parity: ο battered τοίχος μετατοπίζεται (⟂ run) στο
  // cut plane, ίδια προβολή με την 2Δ κάτοψη. shift(mm) × s → plan space των sx/sy.
  const shift = wallCutPlaneShiftMm(wall.params, cutPlaneMm);
  const ws = (shift.dx === 0 && shift.dy === 0) ? 0 : mmToSceneUnits(wall.params.sceneUnits ?? 'mm');
  return {
    id: wall.id,
    sx: wall.params.start.x + shift.dx * ws,
    sy: wall.params.start.y + shift.dy * ws,
    ex: wall.params.end.x + shift.dx * ws,
    ey: wall.params.end.y + shift.dy * ws,
    thicknessM: wall.params.thickness * MM_TO_M,
    baseY: baseProfile.minBaseZmm * MM_TO_M,
    topY: topProfile.maxTopZmm * MM_TO_M,
    topProfile,
    baseProfile,
  };
}

export function toColumnPlan(column: ColumnEntity, floorElevationM = 0, cutPlaneMm = 0): ColumnPlan {
  const baseY = column.params.baseBinding === 'absolute'
    ? column.params.baseOffset * MM_TO_M
    : floorElevationM + column.params.baseOffset * MM_TO_M;
  const topY = column.params.topBinding === 'unconnected' && column.params.unconnectedHeight !== undefined
    ? baseY + column.params.unconnectedHeight * MM_TO_M
    : column.params.topBinding === 'absolute'
      ? column.params.topOffset * MM_TO_M
      : baseY + column.params.height * MM_TO_M;
  // ADR-404 Phase 3 — section parity: η raking κολώνα μετατοπίζεται στο cut plane,
  // ίδια προβολή με την 2Δ κάτοψη. shift(mm) × s → plan space του (canvas-unit) footprint.
  const shift = columnCutPlaneShiftMm(column.params, cutPlaneMm);
  const cs = (shift.dx === 0 && shift.dy === 0) ? 0 : mmToSceneUnits(column.params.sceneUnits ?? 'mm');
  return {
    id: column.id,
    footprint: column.geometry.footprint.vertices.map((v) => [v.x + shift.dx * cs, v.y + shift.dy * cs] as const),
    baseY,
    topY,
  };
}

export function toBeamPlan(beam: BeamEntity): BeamPlan {
  const topY = (beam.params.topElevation + (beam.params.zOffset ?? 0)) * MM_TO_M;
  const depthMm = beam.params.depth;
  const bottomY = topY - depthMm * MM_TO_M;
  return {
    id: beam.id,
    outline: beam.geometry.outline.vertices.map((v) => [v.x, v.y] as const),
    bottomY,
    topY,
    // ADR-401 Phase E/(β): κεκλιμένη δοκός → η παρειά είναι κεκλιμένο επίπεδο
    // κατά μήκος του άξονα. slope offset (mm) × MM_TO_M = world m (ίδια μετατροπή
    // με 3D + τοίχο). Unit-safe (axis fraction — βλ. beam-slope.ts).
    ...(isBeamTilted(beam.params)
      ? {
          slopeYAt: (pt: BeamPlanPoint) => {
            const top = topY + beamSlopeOffsetZmm(beam.params, pt) * MM_TO_M;
            return { topY: top, bottomY: top - depthMm * MM_TO_M };
          },
        }
      : {}),
  };
}

export function toSlabPlan(slab: SlabEntity): SlabPlan {
  const nominalTopMm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
  const topY = nominalTopMm * MM_TO_M;
  const thicknessMm = slab.params.thickness;
  const bottomY = topY - thicknessMm * MM_TO_M;
  // ADR-401 Phase E2: κεκλιμένη πλάκα/στέγη → η παρειά είναι κεκλιμένο επίπεδο.
  // slope offset (canvas units) × MM_TO_M = world m (ίδια μετατροπή με 3D + τοίχο).
  const tilted = slab.params.geometryType === 'tilted' && slab.params.slope !== undefined;
  return {
    id: slab.id,
    outline: slab.params.outline.vertices.map((v) => [v.x, v.y] as const),
    bottomY,
    topY,
    ...(tilted
      ? {
          slopeYAt: (pt: SlabPlanPoint) => {
            const top = topY + slabSlopeOffsetZmm(slab.params, pt) * MM_TO_M;
            return { topY: top, bottomY: top - thicknessMm * MM_TO_M };
          },
        }
      : {}),
  };
}

/**
 * Convert OpeningEntity → plan-space input. Needs host wall για να ξέρει το
 * baseY (floor) reference για το sill height.
 *
 * `wallId` comes from `hostWall.id`, not `opening.params.wallId`: the caller has already
 * resolved the host wall to get here, and since ADR-615 made `params.wallId` optional
 * (self-hosted openings) that field is no longer a guaranteed string. The resolved host
 * is the truthful source either way.
 */
export function toOpeningPlan(opening: OpeningEntity, hostWall: WallPlan): OpeningPlan {
  const dx = hostWall.ex - hostWall.sx;
  const dy = hostWall.ey - hostWall.sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) {
    return { id: opening.id, wallId: hostWall.id, quad: [], sillY: 0, headY: 0 };
  }
  const ux = dx / len;
  const uy = dy / len;
  const offsetM = opening.params.offsetFromStart * MM_TO_M;
  const widthM = opening.params.width * MM_TO_M;
  const s0x = hostWall.sx + ux * offsetM;
  const s0y = hostWall.sy + uy * offsetM;
  const s1x = hostWall.sx + ux * (offsetM + widthM);
  const s1y = hostWall.sy + uy * (offsetM + widthM);
  const sillY = hostWall.baseY + opening.params.sillHeight * MM_TO_M;
  const headY = sillY + opening.params.height * MM_TO_M;
  return {
    id: opening.id,
    wallId: hostWall.id,
    quad: quadCorners(s0x, s0y, s1x, s1y, hostWall.thicknessM / 2),
    sillY,
    headY,
  };
}

// ─── Line-segment / axis-line intersection ───────────────────────────────────

/**
 * Intersect segment (x0,y0)→(x1,y1) with the axis-aligned cutting line.
 * Returns the perpendicular coordinate at the intersection, or null.
 */
export function intersectEdge(
  x0: number, y0: number, x1: number, y1: number,
  axis: SectionAxis, pos: number,
): number | null {
  if (axis === 'x') {
    const d0 = x0 - pos;
    const d1 = x1 - pos;
    if (d0 * d1 > 0) return null;
    const dx = x1 - x0;
    if (Math.abs(dx) < 1e-9) return null;
    const t = (pos - x0) / dx;
    return y0 + t * (y1 - y0);
  }
  const d0 = y0 - pos;
  const d1 = y1 - pos;
  if (d0 * d1 > 0) return null;
  const dy = y1 - y0;
  if (Math.abs(dy) < 1e-9) return null;
  const t = (pos - y0) / dy;
  return x0 + t * (x1 - x0);
}

// ─── Quad helpers (4-corner plan footprint, m) ───────────────────────────────

export function quadCorners(
  sx: number, sy: number, ex: number, ey: number, halfThick: number,
): readonly (readonly [number, number])[] {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 1;
  return [
    [sx + nx * halfThick, sy + ny * halfThick],
    [ex + nx * halfThick, ey + ny * halfThick],
    [ex - nx * halfThick, ey - ny * halfThick],
    [sx - nx * halfThick, sy - ny * halfThick],
  ];
}

/** Intersect a closed polygon με την cutting line. Returns perpendicular span ή null. */
export function intersectPolygon(
  corners: readonly (readonly [number, number])[],
  axis: SectionAxis, pos: number,
): [number, number] | null {
  const hits: number[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const h = intersectEdge(
      corners[i][0], corners[i][1],
      corners[(i + 1) % n][0], corners[(i + 1) % n][1],
      axis, pos,
    );
    if (h !== null) hits.push(h);
  }
  if (hits.length < 2) return null;
  let min = hits[0];
  let max = hits[0];
  for (let i = 1; i < hits.length; i++) {
    if (hits[i] < min) min = hits[i];
    if (hits[i] > max) max = hits[i];
  }
  return max - min > 1e-6 ? [min, max] : null;
}

// ─── Per-element section rect ────────────────────────────────────────────────

/**
 * Παράμετρος `t` (0..1) πάνω στον άξονα του τοίχου, στο σημείο που τον τέμνει
 * η cutting line. `null` αν ο τοίχος είναι παράλληλος στην τομή (degenerate).
 */
function wallAxisParamAtCut(w: WallPlan, axis: SectionAxis, pos: number): number | null {
  const d = axis === 'x' ? w.ex - w.sx : w.ey - w.sy;
  if (Math.abs(d) < 1e-9) return null;
  const t = axis === 'x' ? (pos - w.sx) / d : (pos - w.sy) / d;
  return clamp01(t);
}

export function wallSection(w: WallPlan, axis: SectionAxis, pos: number): SectionRect | null {
  const span = intersectPolygon(
    quadCorners(w.sx, w.sy, w.ex, w.ey, w.thicknessM / 2),
    axis, pos,
  );
  if (!span) return null;
  // ADR-401 Phase B/(γ): σκαλωτή/κεκλιμένη κορυφή **και** βάση → αποτίμησε τα προφίλ
  // στο σημείο της εγκάρσιας τομής. Flat (μη-attached) → ίδιο με `topY`/`baseY`.
  let yMax = w.topY;
  let yMin = w.baseY;
  const needsT = (w.topProfile?.hasAttach ?? false) || (w.baseProfile?.hasAttach ?? false);
  if (needsT) {
    const t = wallAxisParamAtCut(w, axis, pos);
    if (t !== null) {
      if (w.topProfile?.hasAttach) yMax = evaluateWallTopAt(w.topProfile, t) * MM_TO_M;
      if (w.baseProfile?.hasAttach) yMin = evaluateWallBaseAt(w.baseProfile, t) * MM_TO_M;
    }
  }
  return { hMin: span[0], hMax: span[1], yMin, yMax };
}

export function columnSection(c: ColumnPlan, axis: SectionAxis, pos: number): SectionRect | null {
  const span = intersectPolygon(c.footprint, axis, pos);
  if (!span) return null;
  return { hMin: span[0], hMax: span[1], yMin: c.baseY, yMax: c.topY };
}

export function beamSection(b: BeamPlan, axis: SectionAxis, pos: number): SectionRect | null {
  const span = intersectPolygon(b.outline, axis, pos);
  if (!span) return null;
  // ADR-401 Phase E/(β): κεκλιμένη δοκός → αποτίμησε την παρειά στο μέσο της τομής
  // (single-point rect, ίδιος περιορισμός με `slabSection`/`wallSection`).
  if (b.slopeYAt) {
    const mid = (span[0] + span[1]) / 2;
    const pt: BeamPlanPoint = axis === 'x' ? { x: pos, y: mid } : { x: mid, y: pos };
    const { bottomY, topY } = b.slopeYAt(pt);
    return { hMin: span[0], hMax: span[1], yMin: bottomY, yMax: topY };
  }
  return { hMin: span[0], hMax: span[1], yMin: b.bottomY, yMax: b.topY };
}

export function slabSection(s: SlabPlan, axis: SectionAxis, pos: number): SectionRect | null {
  const span = intersectPolygon(s.outline, axis, pos);
  if (!span) return null;
  // ADR-401 Phase E2: κεκλιμένη πλάκα → αποτίμησε την παρειά στο μέσο της τομής
  // (single-point rect, ίδιος περιορισμός με `wallSection`· το πλήρες
  // παραλληλόγραμμο cross-section = follow-up αν χρειαστεί SectionRect επέκταση).
  if (s.slopeYAt) {
    const mid = (span[0] + span[1]) / 2;
    const pt: SlabPlanPoint = axis === 'x' ? { x: pos, y: mid } : { x: mid, y: pos };
    const { bottomY, topY } = s.slopeYAt(pt);
    return { hMin: span[0], hMax: span[1], yMin: bottomY, yMax: topY };
  }
  return { hMin: span[0], hMax: span[1], yMin: s.bottomY, yMax: s.topY };
}

export function openingSection(o: OpeningPlan, axis: SectionAxis, pos: number): SectionRect | null {
  if (o.quad.length === 0) return null;
  const span = intersectPolygon(o.quad, axis, pos);
  if (!span) return null;
  return { hMin: span[0], hMax: span[1], yMin: o.sillY, yMax: o.headY };
}

// ─── Clip wall rect by opening Y-ranges ──────────────────────────────────────

/**
 * Subtract opening gaps from a wall rect. Returns 0..N rects depending on how
 * the openings carve up the wall vertical extent.
 */
export function clipByOpenings(
  wall: SectionRect,
  gaps: readonly { readonly yMin: number; readonly yMax: number }[],
): SectionRect[] {
  if (gaps.length === 0) return [wall];
  const sorted = [...gaps].sort((a, b) => a.yMin - b.yMin);
  const result: SectionRect[] = [];
  let y = wall.yMin;
  for (const gap of sorted) {
    const gMin = Math.max(gap.yMin, wall.yMin);
    const gMax = Math.min(gap.yMax, wall.yMax);
    if (gMin < gMax && y < gMin) {
      result.push({ hMin: wall.hMin, hMax: wall.hMax, yMin: y, yMax: gMin });
    }
    y = Math.max(y, gMax);
  }
  if (y < wall.yMax) {
    result.push({ hMin: wall.hMin, hMax: wall.hMax, yMin: y, yMax: wall.yMax });
  }
  return result;
}
