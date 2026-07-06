'use client';

/**
 * use-grip-tracking-pass — the raw-DXF GRIP-DRAG alignment-tracking layer of the unified overlay
 * dispatch (ADR-537/555). The 3D sibling of the 2D `paintGripActionAlignmentTraces`: while a raw DXF
 * grip (line / polyline vertex OR segment-midpoint) is dragged in 3D, it lights up the SAME white /
 * Polar AutoAlign traces + intersection halos + distance tooltip as the 2D preview canvas, so the 3D
 * grip edit matches the 2D one pixel-for-pixel.
 *
 * FULL SSoT — zero new engine:
 *   · anchor selection → the shared `resolveGripAlignmentAnchors` (2D↔3D) via `gripInfoToAlignmentRole`;
 *   · the resolve → the ONE canonical `resolveActionAlignmentTracking` (the SAME brain the 2D grip drag
 *     + 3D wall placement use), fed the DXF scene entities for full ambient parity;
 *   · the paint → the SAME 2D `tracking-paint` painters, projected through the live camera.
 *
 * Coordinate space: everything resolves in the DXF scene's NATIVE units (`grip.position`/`livePlanPos`
 * are plan-mm → `planMmToScenePoint`; the entity + scene entities are native as-is → ZERO conversion),
 * then the payload projects native → plan-mm → px via `makePlacementOverlayProjector`. This mirrors
 * `use-bim3d-wall-placement` byte-for-byte.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency raw-DXF grip-set flag; the high-frequency
 * live drag position is read imperatively from the non-reactive `grip3DOverlayInteraction` each frame
 * (resolve-in-draw, zero timing skew — mirror of the 2D helper).
 */

import { useSyncExternalStore } from 'react';
import type { Entity } from '../../../types/entities';
import { resolveSceneUnits, mmToSceneUnits } from '../../../utils/scene-units';
import { planMmToScenePoint } from '../../placement/world-to-scene-point';
import { dxfPlanToWorld, getPixelWorldSize } from '../coordinate-transforms';
import { makePlacementOverlayProjector } from '../../placement/placement-overlay-project';
import { resolveActionAlignmentTracking } from '../../../hooks/dimensions/dim-alignment-tracking';
import {
  gripInfoToAlignmentRole,
  resolveGripAlignmentAnchors,
  type GripAlignmentEntityView,
} from '../../../systems/grip/grip-drag-alignment-role';
import { getImmediateSnap } from '../../../systems/cursor/ImmediateSnapStore';
import {
  paintAlignmentPaths,
  paintIntersections,
  paintTooltip,
} from '../../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../../canvas-v2/preview-canvas/tracking-colors';
import { formatSnapTrackingLabel } from '../../../rendering/entities/shared/distance-label-utils';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';
import { findDxfEntityInScope } from '../../scene/dxf-3d-floor-scope';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** One dispatch frame for the grip-tracking layer — resolve-in-draw, SAME 2D painters, 3D projector. */
function paintGripTrackingOverlay({ ctx, camera, canvas }: BimOverlayFrame): void {
  const drag = grip3DOverlayInteraction.drag;
  const grips = useGrip3DOverlayStore.getState().grips;
  if (!drag || grips.length === 0) return;
  const grip = grips[drag.index % grips.length];
  if (!grip?.entityId) return;
  const found = findDxfEntityInScope(grip.entityId);
  if (!found) return;

  // OSNAP-priority (mirror the 2D helper): while a characteristic point is snapping, its marker owns
  // the feedback — no cyan alignment lines.
  if (getImmediateSnap()?.found) return;

  // Resolve in the DXF scene's native units — the entity + scene entities pass through unconverted.
  const sceneUnits = resolveSceneUnits({ units: found.scene.units });
  const cursorNative = planMmToScenePoint(drag.livePlanPos, sceneUnits);
  const anchorNative = planMmToScenePoint(grip.position, sceneUnits);
  const role = gripInfoToAlignmentRole(grip, anchorNative);
  const anchors = resolveGripAlignmentAnchors(found.entity as unknown as GripAlignmentEntityView, role);
  if (!anchors) return;

  // Screen scale at the cursor (native units per px), derived from the live camera — mirror of the
  // wall-placement `scenePerPx` so tolerance/radius/adaptive-step stay zoom-constant. `scale = 1/scenePerPx`.
  const cursorWorld = dxfPlanToWorld(drag.livePlanPos.x, drag.livePlanPos.y, found.floorElevationMm);
  const dist = camera.position.distanceTo(cursorWorld);
  const scenePerPx = getPixelWorldSize(dist, camera, canvas) * 1000 * mmToSceneUnits(sceneUnits);
  const scale = 1 / Math.max(scenePerPx, 1e-9);

  const tracking = resolveActionAlignmentTracking(
    cursorNative, anchors, scale, found.scene.entities as unknown as readonly Entity[],
  );
  if (!tracking) return;

  // Map + paint EXACTLY like the 2D action paint (paths + intersections + tooltip, no acquired markers).
  const r = tracking.result;
  const distScene = Math.hypot(tracking.point.x - r.anchorPoint.x, tracking.point.y - r.anchorPoint.y);
  const distMm = distScene / Math.max(mmToSceneUnits(sceneUnits), 1e-9);
  const label = r.snappedAngle !== null ? formatSnapTrackingLabel(r.snappedAngle, distMm) : null;
  const project = makePlacementOverlayProjector(camera, canvas, sceneUnits, found.floorElevationMm);
  const palette = getCurrentTrackingPalette();
  paintAlignmentPaths(ctx, r.activePaths, project, palette);
  paintIntersections(ctx, r.intersections, project, palette);
  paintTooltip(ctx, tracking.point, label, project, palette);
}

/**
 * The grip-tracking layer as a dispatch pass. Active while a raw-DXF grip set is seated
 * (`dxfGhostEntityIds` non-empty); the paint no-ops until a drag is actually in flight (drag position is
 * the high-frequency non-reactive singleton, read inside `paint`). Hidden during camera motion.
 */
export function useGripTrackingPass(): BimOverlayPass {
  const dxfIds = useSyncExternalStore(
    useGrip3DOverlayStore.subscribe,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds,
    () => useGrip3DOverlayStore.getState().dxfGhostEntityIds,
  );
  return { active: dxfIds.length > 0, hideOnMotion: true, paint: paintGripTrackingOverlay };
}
