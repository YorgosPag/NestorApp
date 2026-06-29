'use client';

/**
 * use-tracking-pass — the Object-Snap-Tracking layer of the unified overlay dispatch (ADR-555).
 * Carries the EXACT draw of the former `Tracking3DOverlay` (ADR-543 COL traces 3D): dashed COL/H-V
 * alignment paths, intersection halos, acquired `+` markers, and the snapped-distance tooltip, drawn
 * with the SAME 2D `tracking-paint` painters the `PreviewRenderer` uses, projected through the live
 * camera via `makePlacementOverlayProjector` (scene → plan-mm → px).
 *
 * Like the 2D guides, the alignment lines are NOT depth-occluded (a guide hidden behind geometry
 * defeats its purpose; Revit keeps temp tracking lines on top). ADR-040 micro-leaf: subscribes ONLY to
 * the low-frequency activation inputs (active tool, 3D view); the per-move payload is read imperatively
 * from the non-reactive `tracking3DData` each frame.
 */

import { useSyncExternalStore } from 'react';
import { toolStateStore } from '../../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../../stores/ViewMode3DStore';
import { makePlacementOverlayProjector } from '../../placement/placement-overlay-project';
import {
  paintAlignmentPaths,
  paintIntersections,
  paintTrackingMarkers,
  paintTooltip,
} from '../../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../../canvas-v2/preview-canvas/tracking-colors';
import { tracking3DData } from '../tracking/tracking-3d-store';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** One dispatch frame for the tracking layer — SAME 2D painters, fed the 3D camera projector. */
function paintTrackingOverlay({ ctx, camera, canvas }: BimOverlayFrame): void {
  const { payload, floorElevationMm, sceneUnits } = tracking3DData;
  if (!payload) return;
  const project = makePlacementOverlayProjector(camera, canvas, sceneUnits, floorElevationMm);
  const palette = getCurrentTrackingPalette();
  paintAlignmentPaths(ctx, payload.paths, project, palette);
  paintIntersections(ctx, payload.intersections, project, palette);
  paintTrackingMarkers(ctx, payload.markers, project, palette);
  paintTooltip(ctx, payload.snappedPoint, payload.label, project, palette);
}

/**
 * The tracking layer as a dispatch pass. Ambient tracking is live the whole time the wall tool is
 * active in 3D (before AND after the first click), so the gate is just `is3D && activeTool === 'wall'`.
 */
export function useTrackingPass(): BimOverlayPass {
  const activeTool = useSyncExternalStore(
    toolStateStore.subscribe,
    () => toolStateStore.get().activeTool,
    () => toolStateStore.get().activeTool,
  );
  const is3D = useViewMode3DStore((s) => selectIs3D(s));
  return { active: is3D && activeTool === 'wall', hideOnMotion: true, paint: paintTrackingOverlay };
}
