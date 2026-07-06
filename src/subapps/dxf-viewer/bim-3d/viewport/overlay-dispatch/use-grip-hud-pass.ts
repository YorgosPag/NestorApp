'use client';

/**
 * use-grip-hud-pass — the raw-DXF GRIP-DRAG «λευκές ενδείξεις» (live length + ∠angle HUD) layer of the
 * unified overlay dispatch (ADR-537/508/555). The 3D sibling of the 2D `drawMemberGripHud` line/polyline
 * branch: while a raw DXF grip is dragged in 3D, EVERY changing leg gets the SAME white length+angle HUD
 * the 2D preview canvas draws — Revit temporary-dimensions parity across both viewports.
 *
 * FULL SSoT — zero new HUD engine:
 *   · segment selection → the shared `resolvePolylineHudSegments` (2D↔3D) via `gripInfoToAlignmentRole`;
 *   · reshaped geometry → `buildDxfGripReshapedVertices` (the SAME «which vertices move» SSoT the ghost uses);
 *   · the paint → `paintWallHudCore` + the shared `makeWallHud3DProjector`, EXACTLY like `use-wall-hud-pass`.
 *
 * Coordinate space: the reshaped vertices are in plan-mm (the ghost's space), so the meta is built with
 * `sceneUnits='mm'` and the projector is the plain plan-mm→px camera projector (mmFactor = 1) — the
 * simplest correct space for the HUD, independent of the tracking pass's native-unit resolve.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency raw-DXF grip-set flag; the live drag position
 * is read imperatively from the non-reactive `grip3DOverlayInteraction` each frame (resolve-in-draw).
 */

import { useSyncExternalStore } from 'react';
import type { GripInfo } from '../../../hooks/grip-types';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { buildSegmentHudMeta, paintWallHudCore } from '../../../canvas-v2/preview-canvas/wall-hud-paint';
import { makeWallHud3DProjector } from './wall-hud-3d-projector';
import {
  gripInfoToAlignmentRole,
  resolvePolylineHudSegments,
  type GripAlignmentEntityView,
} from '../../../systems/grip/grip-drag-alignment-role';
import { buildDxfGripReshapedVertices } from '../../grips/dxf-grip-ghost-paint';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';
import { findDxfEntityInScope } from '../../scene/dxf-3d-floor-scope';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** The vertex-index segment pairs whose length/angle the HUD dimensions for this grip drag, or []. */
function hudSegmentsFor(grip: GripInfo, entity: GripAlignmentEntityView): Array<readonly [number, number]> {
  const role = gripInfoToAlignmentRole(grip, null);
  if (entity.type === 'line') {
    // Line: length+angle on the single segment, unless the rotation handle (its own arc/polar overlay).
    return role.isRotation ? [] : [[0, 1]];
  }
  if (entity.type === 'polyline') {
    // Polyline: skip whole-entity move / rotation (own overlay); else the incident/edge-slide legs.
    if (grip.movesEntity || role.isRotation) return [];
    return resolvePolylineHudSegments(entity, role);
  }
  return [];
}

/** One dispatch frame for the grip-HUD layer — resolve-in-draw, SAME `paintWallHudCore`, 3D projector. */
function paintGripHudOverlay({ ctx, camera, canvas }: BimOverlayFrame): void {
  const drag = grip3DOverlayInteraction.drag;
  const grips = useGrip3DOverlayStore.getState().grips;
  if (!drag || grips.length === 0) return;
  const grip = grips[drag.index % grips.length];
  if (!grip?.entityId) return;
  const found = findDxfEntityInScope(grip.entityId);
  if (!found) return;

  // Reshaped INDEXABLE vertices in plan-mm (null for circle/arc/text → no straight-leg HUD).
  const verts = buildDxfGripReshapedVertices(
    found.entity, grip, drag.livePlanPos, dxfSceneUnitToMm(found.scene),
  );
  if (!verts) return;
  const segments = hudSegmentsFor(grip, found.entity as unknown as GripAlignmentEntityView);
  if (segments.length === 0) return;

  // Reshaped vertices are plan-mm → the HUD works in `sceneUnits='mm'`; the live grip position is the
  // screen-scale reference. Shared 3D wall-HUD projector SSoT (same builder the wall-placement HUD uses).
  const projector = makeWallHud3DProjector(ctx, camera, canvas, 'mm', found.floorElevationMm, drag.livePlanPos);

  for (const [a, b] of segments) {
    if (a >= verts.length || b >= verts.length) continue;
    // `specLabel=''` — a plain line/polyline has no BIM identity (only length + ∠angle).
    paintWallHudCore(ctx, buildSegmentHudMeta(verts[a], verts[b], 'mm'), '', projector);
  }
}

/**
 * The grip-HUD layer as a dispatch pass. Active while a raw-DXF grip set is seated; the paint no-ops
 * until a drag is in flight (high-frequency drag position read inside `paint`). Hidden during motion.
 */
export function useGripHudPass(): BimOverlayPass {
  const dxfIds = useSyncExternalStore(
    useGrip3DOverlayStore.subscribe,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds,
  );
  return { active: dxfIds.length > 0, hideOnMotion: true, paint: paintGripHudOverlay };
}
