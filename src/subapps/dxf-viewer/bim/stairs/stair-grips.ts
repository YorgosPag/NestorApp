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
 *   ADR-358 Phase 5b (all variants):
 *     0 → basePoint              (`stair-base`)
 *     1 → direction handle       (`stair-direction`, base + 100mm·u)
 *     2 → width handle           (`stair-width`, outer stringer midpoint)
 *     3 → length handle          (`stair-length`, walkline end)
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
import type { GripInfo } from '../../hooks/useGripMovement';
import type { StairEntity, StairVariantParams } from '../../bim/types/stair-types';
import {
  DIRECTION_GRIP_OFFSET_MM,
  hasSplitGrip,
  unitVectorFromDirection,
  perpUnit,
  project2D,
  polygonCentroid2D,
} from './stair-grip-math';
import { mmFactorFromWidth } from './stair-floor-link';

// Public API re-exports (consumers import from this module).
export { applyStairGripDrag } from './stair-grip-transforms';
export type { StairGripDragInput } from './stair-grip-transforms';

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

  // 0 — basePoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: base,
    movesEntity: true,
    stairGripKind: 'stair-base',
  });

  // 1 — direction handle
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: { x: base.x + handleOffset * u.x, y: base.y + handleOffset * u.y },
    movesEntity: false,
    stairGripKind: 'stair-direction',
  });

  // 2 — width handle (outer stringer midpoint; fallback to params.width/2)
  const outer = geometry.stringers.outer;
  const widthPos: Point2D = outer.length >= 2
    ? project2D(outer[Math.floor(outer.length / 2)])
    : { x: base.x + (params.width / 2) * p.x, y: base.y + (params.width / 2) * p.y };
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'vertex',
    position: widthPos,
    movesEntity: false,
    stairGripKind: 'stair-width',
  });

  // 3 — length handle (walkline end; fallback to base + totalRun·u)
  const walk = geometry.walkline;
  const lengthPos: Point2D = walk.length >= 1
    ? project2D(walk[walk.length - 1])
    : { x: base.x + params.totalRun * u.x, y: base.y + params.totalRun * u.y };
  grips.push({
    entityId: entity.id,
    gripIndex: 3,
    type: 'vertex',
    position: lengthPos,
    movesEntity: false,
    stairGripKind: 'stair-length',
  });

  if (params.variant.kind === 'straight') {
    pushStraightGrips(grips, entity, base, u, p, handleOffset);
  } else if (hasSplitGrip(params.variant)) {
    pushLandingGrips(grips, entity, base, u, p);
  }

  return grips;
}

// ─── ADR-393 Phase A1 + A2 — straight corner + mid-front grips ───────────────

function pushStraightGrips(
  grips: GripInfo[],
  entity: Readonly<StairEntity>,
  base: Point2D,
  u: { x: number; y: number },
  p: { x: number; y: number },
  handleOffset: number,
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

  // Mid-front start grip — placed one (scene-scaled) handle offset ahead of the
  // first riser (−u side) so it stays clickable instead of colliding with the
  // basePoint grip.
  grips.push({
    entityId: entity.id,
    gripIndex: grips.length,
    type: 'vertex',
    position: { x: base.x - handleOffset * u.x, y: base.y - handleOffset * u.y },
    movesEntity: false,
    stairGripKind: 'stair-start-side',
  });
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
  const n1 = flightSplitFirst(variant);
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

function flightSplitFirst(variant: StairVariantParams): number {
  if (
    variant.kind === 'l-shape' ||
    variant.kind === 'u-shape' ||
    variant.kind === 'gamma'
  ) {
    return variant.flightSplit[0];
  }
  return 1;
}

function variantHasLandingDepthEmit(
  variant: StairVariantParams,
): variant is Extract<StairVariantParams, { landingDepth: 'auto' | number; landingCornerStyle?: unknown }> {
  return (
    (variant.kind === 'l-shape' && variant.cornerStyle === 'landing') ||
    variant.kind === 'u-shape'
  );
}
