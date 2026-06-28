'use client';

/**
 * Tracking3DOverlay — draws the Object-Snap-Tracking alignment overlay (dashed COL/H-V
 * alignment paths, intersection halos, acquired `+` markers, snapped-distance tooltip)
 * in the 3D viewport with the SAME `tracking-paint` painters the 2D `PreviewRenderer`
 * uses (ADR-543 COL traces 3D). Mirror of `WallHudOverlay3D` / `BimPlacementOverlay2D`:
 * a `pointer-events-none` Canvas2D layer over the WebGL viewport that, each RAF frame,
 * reads the LIVE camera and projects the stored tracking payload to canvas px.
 *
 * One source of truth with the 2D drawing tracking: the path geometry comes from the
 * SAME `composeTrackingSnap` (ADR-357 ambient extension), and the visuals from the SAME
 * `paintAlignmentPaths` / `paintIntersections` / `paintTrackingMarkers` / `paintTooltip`
 * (already projector-agnostic). Only the projection (perspective camera vs affine
 * transform) is injected, via `makePlacementOverlayProjector` (scene → plan-mm → px).
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency activation inputs (active
 * tool, 3D view) to start / stop the RAF. The high-frequency tracking payload (changes
 * on every cursor move) is read imperatively from the non-reactive `tracking3DData` each
 * frame (zero re-render). During camera motion the overlay hides and snaps back on
 * settle, mirror of the HUD / grip / snap overlays.
 *
 * Like the 2D guides (and the HUD), the alignment lines are NOT depth-occluded — a guide
 * that disappears behind geometry would defeat its purpose; Revit keeps temp tracking
 * lines on top while drawing.
 */

import { useRef, useCallback, useSyncExternalStore, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { toolStateStore } from '../../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../../stores/ViewMode3DStore';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';
import { useRafWhile, useCameraMotionGate } from '../overlay-raf';
import { makePlacementOverlayProjector } from '../../placement/placement-overlay-project';
import {
  paintAlignmentPaths,
  paintIntersections,
  paintTrackingMarkers,
  paintTooltip,
} from '../../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../../canvas-v2/preview-canvas/tracking-colors';
import { tracking3DData } from './tracking-3d-store';

export interface Tracking3DOverlayProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function Tracking3DOverlay({ managerRef }: Tracking3DOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCameraMoving = useCameraMotionGate();

  // ADR-040 — low-frequency activation gate only. Ambient tracking is live the whole
  // time the wall tool is active in 3D (before AND after the first click), so the gate
  // is just `is3D && activeTool === 'wall'`; the per-move payload drives the visuals.
  const activeTool = useSyncExternalStore(
    toolStateStore.subscribe,
    () => toolStateStore.get().activeTool,
    () => toolStateStore.get().activeTool,
  );
  const is3D = useViewMode3DStore((s) => selectIs3D(s));
  const active = is3D && activeTool === 'wall';

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const camera = manager.getCamera();
    if (!camera) return;

    // Size the overlay canvas to the viewport at DPR + clear (shared SSoT, CSS px).
    const ctx = sizeCanvasToContainerDpr(canvas, container);
    if (!ctx) return;

    // Hide the alignment overlay while the camera moves (orbit/zoom/pan); reappears on settle.
    if (isCameraMoving(camera)) return; // canvas already cleared above

    const { payload, floorElevationMm, sceneUnits } = tracking3DData;
    if (!payload) return;

    // SAME painters as 2D, fed the 3D camera projector (scene → plan-mm → px). The palette
    // is the SAME theme-aware SSoT the PreviewRenderer reads.
    const project = makePlacementOverlayProjector(camera, canvas, sceneUnits, floorElevationMm);
    const palette = getCurrentTrackingPalette();
    paintAlignmentPaths(ctx, payload.paths, project, palette);
    paintIntersections(ctx, payload.intersections, project, palette);
    paintTrackingMarkers(ctx, payload.markers, project, palette);
    paintTooltip(ctx, payload.snappedPoint, payload.label, project, palette);
  }, [managerRef, isCameraMoving]);

  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  useRafWhile(active, draw, onStop, 'tracking'); // 🔬 ADR-549 Phase 0

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
