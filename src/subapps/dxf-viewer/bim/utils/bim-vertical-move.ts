/**
 * bim-vertical-move.ts — pure elevation-move math: a vertical (gizmo axis-Y) delta
 * → new per-type params. ADR-402 (3D Viewport BIM Element Editing) vertical MOVE.
 *
 * ADR-049 Phase 2 (re-home) — moved here from `bim-3d/gizmo/bim3d-vertical-move.ts`
 * so it sits NEUTRAL beside `bim-move-geometry.ts` (the polymorphic plan-move SSoT).
 * The z-component of the unified `MoveEntityCommand` dispatches to these computers
 * from `calculateBimMovedGeometry`, so they must NOT live under `bim-3d` (that would
 * couple the pure command/geometry path to the 3D-viewport tree). The old gizmo
 * module re-exports these for back-compat — its callers stay unchanged.
 *
 * Per-type vertical field (ADR-369 elevation convention — all positive-up):
 *   - wall   → `baseOffset`     (base face offset from storey FFL; wall grows up)
 *   - column → `baseOffset`     (same as wall)
 *   - beam   → `topElevation`   (top face; beam hangs down by `depth`)
 *   - slab   → `levelElevation` (top face / FFL; slab hangs down by `thickness`)
 *   - stair  → `basePoint.z`    (floor-start elevation)
 *
 * Units: `deltaUpMm` is millimetres (from `worldUpDeltaToMm`). wall/column/beam/slab
 * store raw mm → add directly. The stair stores `basePoint` in inferred DRAWING units
 * (ADR-358), so the mm delta is converted with the SAME factor the stair grips / resize
 * bridge use (`mmToEntityUnitFactor`). Pure — no three / no scene / no command dispatch.
 */

import type { WallParams } from '../types/wall-types';
import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';
import type { SlabParams } from '../types/slab-types';
import type { StairParams, StairEntity } from '../types/stair-types';
import type { MepSegmentParams } from '../types/mep-segment-types';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../types/mep-segment-types';
import { mmToEntityUnitFactor } from './entity-unit-factor';

/** Wall vertical move → `baseOffset += Δ` (whole wall shifts; top follows). */
export function computeWallVerticalMove(params: WallParams, deltaUpMm: number): WallParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, baseOffset: params.baseOffset + deltaUpMm };
}

/** Column vertical move → `baseOffset += Δ` (mirror of wall). */
export function computeColumnVerticalMove(params: ColumnParams, deltaUpMm: number): ColumnParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, baseOffset: params.baseOffset + deltaUpMm };
}

/** Beam vertical move → `topElevation += Δ` (top face moves; depth fixed → whole beam shifts). */
export function computeBeamVerticalMove(params: BeamParams, deltaUpMm: number): BeamParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, topElevation: params.topElevation + deltaUpMm };
}

/** Slab vertical move → `levelElevation += Δ` (top face moves; thickness fixed → whole slab shifts). */
export function computeSlabVerticalMove(params: SlabParams, deltaUpMm: number): SlabParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, levelElevation: params.levelElevation + deltaUpMm };
}

/**
 * Stair vertical move → `basePoint.z += Δ`, with the mm delta converted into the
 * stair's drawing-unit space (the ONLY BIM type not stored in raw mm — ADR-358).
 */
export function computeStairVerticalMove(entity: StairEntity, deltaUpMm: number): StairParams | null {
  if (deltaUpMm === 0) return null;
  const params = entity.params;
  const deltaUnits = deltaUpMm * mmToEntityUnitFactor(entity);
  return {
    ...params,
    basePoint: { ...params.basePoint, z: params.basePoint.z + deltaUnits },
  };
}

/**
 * ADR-408 Φ-C (3D gizmo) — point-based MEP host (fixture / manifold / radiator /
 * boiler / water-heater) vertical move → `mountingElevationMm += Δ` (raw mm). The
 * whole body + its connectors shift up; connected pipes follow via the connectivity
 * resolver. Generic over the host params (all carry `mountingElevationMm`).
 */
export function computeMepHostVerticalMove<P extends { mountingElevationMm: number }>(
  params: P,
  deltaUpMm: number,
): P | null {
  if (deltaUpMm === 0) return null;
  return { ...params, mountingElevationMm: params.mountingElevationMm + deltaUpMm };
}

/**
 * ADR-408 Φ-C (3D gizmo) — MEP segment (pipe) vertical move → both endpoint z's
 * shift by Δ (raw mm; the per-endpoint elevation SSoT is in mm), `centerlineElevationMm`
 * re-derived. A sloped run keeps its slope (both ends move equally).
 */
export function computeMepSegmentVerticalMove(
  params: MepSegmentParams,
  deltaUpMm: number,
): MepSegmentParams | null {
  if (deltaUpMm === 0) return null;
  const elev = resolveSegmentEndpointElevationsMm(params);
  const startZ = elev.startMm + deltaUpMm;
  const endZ = elev.endMm + deltaUpMm;
  return {
    ...params,
    startPoint: { ...params.startPoint, z: startZ },
    endPoint: { ...params.endPoint, z: endZ },
    centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
  };
}
