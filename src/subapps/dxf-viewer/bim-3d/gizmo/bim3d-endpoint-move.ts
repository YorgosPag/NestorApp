/**
 * bim3d-endpoint-move.ts — pure per-endpoint drag math: gizmo endpoint handle →
 * new segment params (ADR-408 Φ-D, Revit shape-handles).
 *
 * Sibling of `bim3d-resize-bridge` / `bim3d-vertical-move` for the endpoint path.
 * Dragging an endpoint square handle relocates ONE axis end of a linear MEP segment
 * (the other end stays fixed) in BOTH plan and elevation — the pipe stretches /
 * shortens / re-aims from that end.
 *
 * Plan (X,Y) reuses the 2D grip SSoT (`applyMepSegmentGripDrag` start/end) so the
 * horizontal math lives in ONE place. Elevation (z) is handled here because the
 * grip helper deliberately keeps z fixed: the per-endpoint elevation SSoT is
 * `resolveSegmentEndpointElevationsMm` (NOT the raw `startPoint.z`, which is 0 on a
 * legacy horizontal run whose real elevation is `centerlineElevationMm`). So we
 * resolve BOTH ends, bump the dragged end by `deltaUpMm`, write both normalised z's
 * back and re-derive `centerlineElevationMm` — exactly the self-healing pattern of
 * `computeMepSegmentVerticalMove`. This avoids the "legacy end drops to z=0" bug.
 *
 * UNITS: `deltaCanvas` is the plan delta already in the entity's NATIVE canvas
 * units (the command builder scales the DXF-mm gizmo delta by `mmToEntityUnitFactor`,
 * mirroring the move/rotate path). `deltaUpMm` is raw mm (the z SSoT is mm). Pure —
 * no three / no scene / no command dispatch.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { MepSegmentParams } from '../../bim/types/mep-segment-types';
import {
  resolveSegmentEndpointElevationsMm,
  deriveCenterlineElevationMm,
} from '../../bim/types/mep-segment-types';
import { applyMepSegmentGripDrag } from '../../bim/mep-segments/mep-segment-grips';
import type { WallParams } from '../../bim/types/wall-types';
import type { BeamParams } from '../../bim/types/beam-types';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import type { GizmoEndpoint } from './gizmo-types';

/**
 * ADR-408 Φ-D — move ONE endpoint of a segment by a plan delta (canvas units) +
 * an elevation delta (mm). The other endpoint is untouched. Returns `null` for a
 * no-op drag (zero plan + zero vertical). The plan move delegates to the 2D grip
 * SSoT; the z is resolved + normalised here so a legacy horizontal run is lifted
 * correctly (never dropped to 0).
 */
export function computeMepSegmentEndpointMove(
  params: MepSegmentParams,
  endpoint: GizmoEndpoint,
  deltaCanvas: Point2D,
  deltaUpMm: number,
): MepSegmentParams | null {
  if (deltaCanvas.x === 0 && deltaCanvas.y === 0 && deltaUpMm === 0) return null;

  // Plan (X,Y) via the 2D grip SSoT (keeps the horizontal math in one place).
  const gripKind = endpoint === 'start' ? 'mep-segment-start' : 'mep-segment-end';
  const planMoved = applyMepSegmentGripDrag(gripKind, { originalParams: params, delta: deltaCanvas });

  // Elevation (z): resolve BOTH ends (legacy-safe), bump only the dragged end,
  // write both back normalised + re-derive the centreline cache.
  const elev = resolveSegmentEndpointElevationsMm(params);
  const startZ = elev.startMm + (endpoint === 'start' ? deltaUpMm : 0);
  const endZ = elev.endMm + (endpoint === 'end' ? deltaUpMm : 0);

  return {
    ...planMoved,
    startPoint: { ...planMoved.startPoint, z: startZ },
    endPoint: { ...planMoved.endPoint, z: endZ },
    centerlineElevationMm: deriveCenterlineElevationMm(startZ, endZ),
  };
}

/**
 * ADR-408 Φ1 — move ONE end of a WALL by a plan delta (canvas units). The other
 * end stays fixed → the wall re-aims / lengthens from the dragged end (Revit length
 * shape-handle). Pure plan edit (no z — the wall height is a separate handle/Type),
 * delegating to the 2D wall grip SSoT (`wall-start`/`wall-end` → `moveStart`/`moveEnd`).
 * Returns `null` for a zero-delta no-op. The dragged endpoint's miter is cleared by
 * the grip SSoT (recomputed at commit by `computeWallGeometry`).
 */
export function computeWallEndpointMove(
  params: WallParams,
  endpoint: GizmoEndpoint,
  deltaCanvas: Point2D,
): WallParams | null {
  if (deltaCanvas.x === 0 && deltaCanvas.y === 0) return null;
  const anchor = endpoint === 'start' ? params.start : params.end;
  return applyWallGripDrag(endpoint === 'start' ? 'wall-start' : 'wall-end', {
    originalParams: params,
    delta: deltaCanvas,
    // `currentPos` is unused by moveStart/moveEnd; pass the new endpoint for type-completeness.
    currentPos: { x: anchor.x + deltaCanvas.x, y: anchor.y + deltaCanvas.y },
  });
}

/**
 * ADR-408 Φ1 — move ONE end of a BEAM by a plan delta (canvas units). Mirror of the
 * wall path: the other end stays fixed → the beam re-aims / lengthens from the dragged
 * end (Revit length shape-handle). Delegates to the 2D beam grip SSoT
 * (`beam-start`/`beam-end` → `moveStart`/`moveEnd`). Pure plan edit (the beam top
 * elevation / depth are separate edits). Returns `null` for a zero-delta no-op.
 */
export function computeBeamEndpointMove(
  params: BeamParams,
  endpoint: GizmoEndpoint,
  deltaCanvas: Point2D,
): BeamParams | null {
  if (deltaCanvas.x === 0 && deltaCanvas.y === 0) return null;
  return applyBeamGripDrag(endpoint === 'start' ? 'beam-start' : 'beam-end', {
    originalParams: params,
    delta: deltaCanvas,
  });
}
