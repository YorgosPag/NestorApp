/**
 * ADR-358 Phase 5b + ADR-393 — Stair parametric grip positions.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. `getStairGrips()`
 * produces `GripInfo[]` consumed by `computeDxfEntityGrips`
 * (`hooks/grip-computation.ts`). The drag transforms live in
 * `stair-grip-transforms.ts` (re-exported below for a stable public API) and the
 * shared math in `stair-grip-math.ts`.
 *
 * Grip layout:
 *   ADR-358 Phase 5b + ADR-393 v2:
 *     0 → basePoint (MOVE)       (`stair-base`, displayed at walkline arc-midpoint)
 *     1 → direction (ROTATION)   (`stair-direction`, displayed front-centre = base − 100mm·u)
 *     2 → width handle           (`stair-width`, outer stringer midpoint — NON-straight only)
 *     3 → length handle          (`stair-length`, walkline end — NON-straight only)
 *   ADR-393 v2: for `straight` the width/length/mid-front grips are SUPPRESSED
 *   (the 4 corners own both resize axes); for curved variants they stay. The
 *   MOVE + ROTATION handles get icon glyphs via `stairGripGlyphShape()`.
 *   ADR-393 Phase A1 (straight only) — asymmetric corners (mirror ADR-363
 *   Phase 1C-bis walls):
 *     · start-left / start-right (`stair-corner-start-{left,right}`)
 *     · end-left   / end-right   (`stair-corner-end-{left,right}`)
 *   ADR-393 Phase A2 (straight only):
 *     · mid-front start          (`stair-start-side`)
 *   ADR-393 Phase B1 (l-shape / u-shape / gamma) — replace legacy split:
 *     · flight-1 end             (`stair-flight1-end`, landing entry edge)
 *     · flight-2 start           (`stair-flight2-start`, landing exit edge)
 *   ADR-393 Phase B2 (l-shape-landing / u-shape):
 *     · landing depth            (`stair-landing-depth`)
 *     · landing corner radius    (`stair-landing-corner-radius`, chamfer/fillet)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-393-bim-stair-extended-grips.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type { GripInfo, StairGripKind } from '../../hooks/useGripMovement';
import type { GripShape } from '../../rendering/grips/types';
import type { StairEntity, StairVariantParams } from '../../bim/types/stair-types';
import {
  DIRECTION_GRIP_OFFSET_MM,
  hasSplitGrip,
  unitVectorFromDirection,
  perpUnit,
  project2D,
  polygonCentroid2D,
  polylineArcMidpoint,
  lastSegmentDir,
  flightCount,
} from './stair-grip-math';
import { mmFactorFromWidth } from './stair-floor-link';
import { gripGlyphShape } from '../grips/grip-glyph-registry';

// Public API re-exports (consumers import from this module).
export { applyStairGripDrag } from './stair-grip-transforms';
export type { StairGripDragInput } from './stair-grip-transforms';

/**
 * ADR-393 v2 — map a stair grip kind to its rendered glyph shape. ADR-397: thin
 * wrapper over the shared `gripGlyphShape` registry SSoT (the basePoint MOVE +
 * direction ROTATION glyphs live there alongside every other BIM entity). Kept
 * for back-compat call sites. Consumed by `StairRenderer.getGrips`.
 */
export function stairGripGlyphShape(kind: StairGripKind | undefined): GripShape {
  return gripGlyphShape(kind);
}

/**
 * Compute the parametric grip positions for a `StairEntity`. Order is stable so
 * `gripIndex` is a deterministic identifier across drags: the ADR-358 base grips
 * keep indices 0-3; ADR-393 grips append via `grips.length`.
 */
export function getStairGrips(entity: Readonly<StairEntity>): GripInfo[] {
  const { params, geometry } = entity;
  const u = unitVectorFromDirection(params.direction);
  const p = perpUnit(u);
  const base = project2D(params.basePoint);
  // The 100 mm handle offset is a physical distance; convert it to scene units
  // via the same SSoT factor the length grip uses (`mmFactorFromWidth`) so the
  // direction + mid-front handles do not land 1000× away in metre/cm scenes.
  // See feedback: BIM grip positions must stay scene-unit-correct.
  const handleOffset = DIRECTION_GRIP_OFFSET_MM / mmFactorFromWidth(params.width);

  const grips: GripInfo[] = [];

  // 0 — basePoint (MOVE handle). ADR-393 v2: displayed at the walkline
  // arc-midpoint (centre of the climbing path) instead of the front edge so it
  // reads as "grab here to move the whole stair". Drag is delta-based, so the
  // display position does not affect the transform.
  const moveAnchor: Point2D = polylineArcMidpoint(geometry.walkline) ?? {
    x: base.x + (params.totalRun / 2) * u.x,
    y: base.y + (params.totalRun / 2) * u.y,
  };
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: moveAnchor,
    movesEntity: true,
    stairGripKind: 'stair-base',
  });

  // 1 — direction handle (ROTATION). ADR-393 v2: displayed at the front-centre
  // (one scene-scaled handle offset ahead of the first riser, −u side). The
  // rotation pivot stays `basePoint` (= front-edge centre); `rotateDirection`
  // is anchor-relative so grabbing the handle off the +u axis no longer flips
  // the stair on mousedown.
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: { x: base.x - handleOffset * u.x, y: base.y - handleOffset * u.y },
    movesEntity: false,
    stairGripKind: 'stair-direction',
  });

  if (params.variant.kind === 'straight') {
    // ADR-393 v2: width + length + mid-front grips are SUPPRESSED for straight
    // stairs — the 4 corner grips own both resize axes (perp→width,
    // axial→length, opposite face anchored). The transforms + union members are
    // kept (the corners reuse them); they are simply not emitted here.
    pushStraightGrips(grips, entity, base, u, p);
  } else if (hasSplitGrip(params.variant)) {
    // ADR-393 v2 Phase 2 — L/U/Γ: the on-axis width + length handles are
    // SUPPRESSED here too; 4 corner grips (positions READ from the computed
    // stringer endpoints, SSoT) own width + per-flight length. Landing grips
    // stay. The end corner sits on the LAST flight (a different direction than
    // the start corner — the stair bends at the landing).
    pushFlightBasedCorners(grips, entity, u, p);
    pushLandingGrips(grips, entity, base, u, p);
  } else {
    // Curved (spiral/helical/elliptical/winder/triangular×2/sketch/v-shape):
    // no rectangular footprint → keep the on-axis width + length handles
    // permanently (no corners make sense on an arc).
    pushAxisWidthLength(grips, entity, base, u, p);
  }

  return grips;
}

// ─── ADR-358 Phase 5b — axis width + length handles (non-straight variants) ──

/**
 * The two on-axis resize handles (`stair-width` at the outer-stringer midpoint,
 * `stair-length` at the walkline end). Emitted for every non-straight variant.
 * Straight stairs suppress these in favour of the 4 corner grips (ADR-393 v2).
 */
function pushAxisWidthLength(
  grips: GripInfo[],
  entity: Readonly<StairEntity>,
  base: Point2D,
  u: { x: number; y: number },
  p: { x: number; y: number },
): void {
  const { params, geometry } = entity;

  // width handle (outer stringer midpoint; fallback to params.width/2)
  const outer = geometry.stringers.outer;
  const widthPos: Point2D = outer.length >= 2
    ? project2D(outer[Math.floor(outer.length / 2)])
    : { x: base.x + (params.width / 2) * p.x, y: base.y + (params.width / 2) * p.y };
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: widthPos,
    movesEntity: false,
    stairGripKind: 'stair-width',
  });

  // length handle (walkline end; fallback to base + totalRun·u)
  const walk = geometry.walkline;
  const lengthPos: Point2D = walk.length >= 1
    ? project2D(walk[walk.length - 1])
    : { x: base.x + params.totalRun * u.x, y: base.y + params.totalRun * u.y };
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: lengthPos,
    movesEntity: false,
    stairGripKind: 'stair-length',
  });
}

// ─── ADR-393 Phase A1 + A2 — straight corner + mid-front grips ───────────────

function pushStraightGrips(
  grips: GripInfo[],
  entity: Readonly<StairEntity>,
  base: Point2D,
  u: { x: number; y: number },
  p: { x: number; y: number },
): void {
  const { params } = entity;
  const half = params.width / 2;
  const backX = base.x + params.totalRun * u.x;
  const backY = base.y + params.totalRun * u.y;

  const corners: ReadonlyArray<{ pos: Point2D; kind: GripInfo['stairGripKind'] }> = [
    { pos: { x: base.x + half * p.x, y: base.y + half * p.y }, kind: 'stair-corner-start-left' },
    { pos: { x: base.x - half * p.x, y: base.y - half * p.y }, kind: 'stair-corner-start-right' },
    { pos: { x: backX + half * p.x, y: backY + half * p.y }, kind: 'stair-corner-end-left' },
    { pos: { x: backX - half * p.x, y: backY - half * p.y }, kind: 'stair-corner-end-right' },
  ];
  for (const c of corners) {
    grips.push({
      entityId: entity.id,
      gripIndex: grips.length,
      type: 'vertex',
      position: c.pos,
      movesEntity: false,
      stairGripKind: c.kind,
    });
  }
  // ADR-393 v2: the legacy `stair-start-side` mid-front grip is no longer
  // emitted — the rotation handle now occupies the front-centre slot, and the
  // start corners cover the front-edge resize. The transform + union member are
  // retained for backward-compat / Phase-2 reuse.
}

// ─── ADR-393 v2 Phase 2 — flight-based corners (L/U/Γ) ───────────────────────

/** Signed side of `pt` relative to `ref` along `perpDir` (>0 ⇒ +perp = left). */
function sidePerp(pt: Point2D, ref: Point2D, perpDir: { x: number; y: number }): number {
  return (pt.x - ref.x) * perpDir.x + (pt.y - ref.y) * perpDir.y;
}

/**
 * Emit the 4 asymmetric corner grips for a split variant (l-shape / u-shape /
 * gamma). Positions are READ from the computed geometry (`stringers` endpoints
 * + `walkline`) — the SSoT rule: grip positions come from geometry, never
 * re-derived from raw mm params (off-screen-in-metre-scenes class of bug).
 *
 * The start corners are the entry edge of flight-1 (`stringers.*[0]`); the end
 * corners are the exit edge of the LAST flight (`stringers.*[last]`). Each pair
 * is classified left/right by the side of its flight's perpendicular it sits on
 * (start uses flight-1's perp `p`, end uses the last segment's perp) so the kind
 * matches the transform's `perpSign` (+1 = left).
 */
function pushFlightBasedCorners(
  grips: GripInfo[],
  entity: Readonly<StairEntity>,
  u: { x: number; y: number },
  p: { x: number; y: number },
): void {
  const { geometry, params } = entity;
  const walk = geometry.walkline;
  const outer = geometry.stringers.outer;
  const inner = geometry.stringers.inner;

  // Defensive: geometry not computed yet → fall back to flight-1 footprint.
  if (walk.length < 2 || outer.length < 1 || inner.length < 1) {
    pushStraightGrips(grips, entity, project2D(params.basePoint), u, p);
    return;
  }

  const startRef = project2D(walk[0]);
  const endRef = project2D(walk[walk.length - 1]);
  const pLast = perpUnit(lastSegmentDir(walk) ?? u);

  const startA = project2D(outer[0]);
  const startB = project2D(inner[0]);
  const endA = project2D(outer[outer.length - 1]);
  const endB = project2D(inner[inner.length - 1]);

  const startLeftIsA = sidePerp(startA, startRef, p) >= 0;
  const endLeftIsA = sidePerp(endA, endRef, pLast) >= 0;

  const corners: ReadonlyArray<{ pos: Point2D; kind: GripInfo['stairGripKind'] }> = [
    { pos: startLeftIsA ? startA : startB, kind: 'stair-corner-start-left' },
    { pos: startLeftIsA ? startB : startA, kind: 'stair-corner-start-right' },
    { pos: endLeftIsA ? endA : endB, kind: 'stair-corner-end-left' },
    { pos: endLeftIsA ? endB : endA, kind: 'stair-corner-end-right' },
  ];
  for (const c of corners) {
    grips.push({
      entityId: entity.id,
      gripIndex: grips.length,
      type: 'vertex',
      position: c.pos,
      movesEntity: false,
      stairGripKind: c.kind,
    });
  }
}

// ─── ADR-393 Phase B1 + B2 — landing edge + depth + corner-radius grips ──────

interface LandingFrameBox {
  readonly centroid: Point2D;
  readonly halfU: number;
  readonly halfP: number;
}

/** Axis-aligned extent of a landing polygon expressed in the (u, p) frame. */
function landingFrameBox(
  polygon: ReadonlyArray<Point3D>,
  u: { x: number; y: number },
  p: { x: number; y: number },
): LandingFrameBox {
  let minU = Infinity, maxU = -Infinity, minP = Infinity, maxP = -Infinity;
  for (const v of polygon) {
    const pu = v.x * u.x + v.y * u.y;
    const pp = v.x * p.x + v.y * p.y;
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pp < minP) minP = pp;
    if (pp > maxP) maxP = pp;
  }
  return { centroid: polygonCentroid2D(polygon), halfU: (maxU - minU) / 2, halfP: (maxP - minP) / 2 };
}

function pushLandingGrips(
  grips: GripInfo[],
  entity: Readonly<StairEntity>,
  base: Point2D,
  u: { x: number; y: number },
  p: { x: number; y: number },
): void {
  const { params, geometry } = entity;
  const variant = params.variant;
  const landing = geometry.landings.length > 0 ? geometry.landings[0] : undefined;

  // Flight-1 length along u (for fallbacks when no landing geometry exists yet).
  const n1 = flightCount(variant, 'first');
  const flight1Run = n1 * params.tread;
  const fallbackDepth = params.width;

  const box: LandingFrameBox = landing && landing.length > 0
    ? landingFrameBox(landing, u, p)
    : {
        centroid: {
          x: base.x + (flight1Run + fallbackDepth / 2) * u.x,
          y: base.y + (flight1Run + fallbackDepth / 2) * u.y,
        },
        halfU: fallbackDepth / 2,
        halfP: params.width / 2,
      };

  // G12 — flight-1 end (landing entry edge midpoint).
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: { x: box.centroid.x - box.halfU * u.x, y: box.centroid.y - box.halfU * u.y },
    movesEntity: false,
    stairGripKind: 'stair-flight1-end',
  });

  // G13 — flight-2 start (landing exit edge midpoint).
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: { x: box.centroid.x + box.halfU * u.x, y: box.centroid.y + box.halfU * u.y },
    movesEntity: false,
    stairGripKind: 'stair-flight2-start',
  });

  if (!variantHasLandingDepthEmit(variant)) return;

  // G15 — landing depth (landing +p side edge midpoint).
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: { x: box.centroid.x + box.halfP * p.x, y: box.centroid.y + box.halfP * p.y },
    movesEntity: false,
    stairGripKind: 'stair-landing-depth',
  });

  // G17 — landing corner radius (far +u,+p corner) — only for chamfer/fillet.
  if (variant.landingCornerStyle === 'chamfer' || variant.landingCornerStyle === 'fillet') {
    grips.push({
      entityId: entity.id,
      gripIndex: grips.length,
      type: 'vertex',
      position: {
        x: box.centroid.x + box.halfU * u.x + box.halfP * p.x,
        y: box.centroid.y + box.halfU * u.y + box.halfP * p.y,
      },
      movesEntity: false,
      stairGripKind: 'stair-landing-corner-radius',
    });
  }
}

function variantHasLandingDepthEmit(
  variant: StairVariantParams,
): variant is Extract<StairVariantParams, { landingDepth: 'auto' | number; landingCornerStyle?: unknown }> {
  return (
    (variant.kind === 'l-shape' && variant.cornerStyle === 'landing') ||
    variant.kind === 'u-shape'
  );
}
