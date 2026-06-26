'use client';

/**
 * BimGripOverlay2D — Canvas2D overlay that draws the 3D reshape grips with the SAME 2D
 * `UnifiedGripRenderer` (ADR-535 Φ5).
 *
 * Φ5 replaces the in-scene grip cubes (WebGL `BoxGeometry`) with a 2D overlay canvas
 * absolutely positioned over the WebGL viewport — mirror of `CropRegionOverlay`. Each frame
 * (RAF, 60fps) it reads the LIVE camera, projects every grip's plan point to canvas-local
 * px (`makeGripPlanToCanvas`), and paints through the EXACT 2D grip renderer with the EXACT
 * 2D settings (`getGripPreviewStyle`) — so the 3D grips are byte-identical to the 2D canvas
 * grips (same 7px square, same colours, same hover warmth) and zoom is continuous (drawn
 * every frame, never stepped). One render code = one source of truth.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency grip set (to start / stop the
 * RAF); the high-frequency hover index + live drag position are read imperatively from the
 * non-reactive `grip3DOverlayInteraction` each frame (zero re-render). `pointer-events-none`
 * — interaction stays on the WebGL canvas below (the controller hit-tests in screen space).
 */

import { useRef, useEffect, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { UnifiedGripRenderer } from '../../../rendering/grips';
import type { GripSettings } from '../../../rendering/grips/types';
import type { Point2D } from '../../../rendering/types/Types';
import type { GripInfo } from '../../../hooks/grip-types';
import { getGripPreviewStyle } from '../../../hooks/useGripPreviewStyle';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { buildTwinSurfaceConfigs } from '../../grips/grip-3d-twin-overlay';
import { GripDepthOccluder } from '../../grips/grip-3d-depth-occluder';
import { buildDxfGhostSegments } from '../../grips/dxf-grip-ghost-paint';
import { dxfPlanToWorld } from '../coordinate-transforms';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';
import { useDxfOverlay3DStore } from '../../stores/DxfOverlay3DStore';

export interface BimGripOverlay2DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** ADR-537 — raw DXF live-ghost stroke (Revit-blue dashed, mirror the cold grip hue). */
const DXF_GHOST_STROKE = 'rgba(80, 160, 255, 0.9)';

/**
 * ADR-537 — stroke the live ghost of a raw DXF entity being grip-dragged. Reads the
 * ghost entity id (low-freq store) + the live drag (non-reactive singleton); builds the
 * entity-in-progress geometry via the pure `buildDxfGhostSegments` and projects every
 * point with the SAME projector the grips use (so the ghost tracks the squares pixel-for-
 * pixel). No-op for BIM grips (`dxfGhostEntityId === null`) or when no drag is in flight.
 */
function paintDxfGhost(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  grips: readonly GripInfo[],
): void {
  const ghostId = useGrip3DOverlayStore.getState().dxfGhostEntityId;
  const drag = grip3DOverlayInteraction.drag;
  if (!ghostId || !drag || grips.length === 0) return;
  const grip = grips[drag.index % grips.length];
  if (!grip) return;
  const entity = useDxfOverlay3DStore.getState().dxfScene?.entities.find((e) => e.id === ghostId);
  if (!entity) return;
  const segments = buildDxfGhostSegments(entity, grip, drag.livePlanPos);
  if (segments.length === 0) return;
  ctx.save();
  ctx.strokeStyle = DXF_GHOST_STROKE;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  for (const seg of segments) {
    if (seg.length < 2) continue;
    ctx.beginPath();
    const p0 = project(seg[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < seg.length; i++) {
      const p = project(seg[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function BimGripOverlay2D({ managerRef }: BimGripOverlay2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // ADR-535 Φ5b — GPU depth-occluder (one instance, lazy GPU resources, disposed on unmount).
  const occluderRef = useRef<GripDepthOccluder | null>(null);
  // ADR-535/536 — last camera pose, to HIDE grips during camera motion (orbit/zoom/pan).
  // While moving, the occluder's full-scene depth pre-pass + the 2D draws are skipped → the
  // grips vanish and the navigation stays smooth; they snap back with correct occlusion the
  // instant the camera settles. The continuous RAF guarantees that settle frame. Big-player
  // CAD/BIM pattern («hide handles during navigation»).
  const lastCamWorldRef = useRef(new THREE.Matrix4());
  const lastCamProjRef = useRef(new THREE.Matrix4());
  const camPoseValidRef = useRef(false);

  // ADR-040 — subscribe ONLY to the low-frequency grip set (drives the RAF on/off).
  const grips = useSyncExternalStore(
    useGrip3DOverlayStore.subscribe,
    () => useGrip3DOverlayStore.getState().grips,
    () => useGrip3DOverlayStore.getState().grips,
  );
  const hasGrips = grips.length > 0;

  // One frame: size the canvas (DPR), project every grip through the live camera, paint
  // with the 2D grip renderer. Reads the store + interaction fresh each call (no deps).
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const camera = manager.getCamera();
    if (!camera) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const dw = Math.round(cw * dpr);
    const dh = Math.round(ch * dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Work in CSS px (the projector returns CSS-px canvas-local coords); the renderer's
    // 7px grip is then real 7 CSS px, identical to the 2D canvas (which also uses dpiScale 1).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // ADR-535/536 — skip everything (occluder depth pre-pass + 2D draws) while the camera
    // moves: grips vanish during orbit/zoom/pan, snap back (correctly occluded) on settle.
    const camMoving =
      camPoseValidRef.current &&
      (!lastCamWorldRef.current.equals(camera.matrixWorld) ||
        !lastCamProjRef.current.equals(camera.projectionMatrix));
    lastCamWorldRef.current.copy(camera.matrixWorld);
    lastCamProjRef.current.copy(camera.projectionMatrix);
    camPoseValidRef.current = true;
    if (camMoving) return; // canvas already cleared above → grips hidden during motion

    const { grips: liveGrips, topElevFor, bottomElevFor } = useGrip3DOverlayStore.getState();
    const n = liveGrips.length;
    if (n === 0) return;

    // ADR-535 Φ6 — TWO projectors: each grip is drawn on its top AND bottom face (twin), with
    // the matching surface elevation. Same renderer, same configs logic, one pass per surface.
    const projectTop = makeGripPlanToCanvas(camera, canvas, topElevFor);
    const projectBottom = makeGripPlanToCanvas(camera, canvas, bottomElevFor);
    const { hoverIndex, drag } = grip3DOverlayInteraction;

    // EXACT 2D settings SSoT (mirror `GripPhaseRenderer.renderStandardGrips`).
    const style = getGripPreviewStyle();
    const settings: Partial<GripSettings> = {
      colors: style.colors,
      gripSize: style.gripSize,
      dpiScale: 1.0,
    };

    // ADR-535 Φ5b/Φ6 — Revit / Maxon (Cinema 4D) grade depth occlusion over the 2N twin squares
    // (first N = top faces, next N = bottom faces). A square behind a solid surface is culled on
    // the GPU — this is what hides the bottom twins when looking from above (and the top twins
    // from below) for FREE. The occluder publishes per-flat-index visibility to the shared
    // non-reactive state, so the controller's hit-test culls the same squares.
    const occluder = occluderRef.current;
    let visibility: readonly boolean[] | null = null;
    if (occluder) {
      const worlds = [
        ...liveGrips.map((g) => dxfPlanToWorld(g.position.x, g.position.y, topElevFor(g.position))),
        ...liveGrips.map((g) => dxfPlanToWorld(g.position.x, g.position.y, bottomElevFor(g.position))),
      ];
      visibility = occluder.computeVisibility(manager.renderer, manager.scene, camera, worlds);
    }
    grip3DOverlayInteraction.visibility = visibility;

    const ov = {
      hoverIndex,
      dragIndex: drag?.index ?? null,
      dragLivePlanPos: drag?.livePlanPos ?? null,
      visibility,
    };
    // ADR-537 — raw DXF live ghost (entity-in-progress) UNDER the grip squares, so the
    // 7px handles stay crisp on top. No-op for BIM grips / when idle.
    paintDxfGhost(ctx, projectTop, liveGrips);
    // Top pass (flat offset 0) + bottom pass (flat offset N), each through its own projector.
    new UnifiedGripRenderer(ctx, projectTop).renderGripSetBatched(buildTwinSurfaceConfigs(liveGrips, 0, ov), settings);
    new UnifiedGripRenderer(ctx, projectBottom).renderGripSetBatched(buildTwinSurfaceConfigs(liveGrips, n, ov), settings);
  }, [managerRef]);

  // ADR-535 Φ5b — own the GPU occluder for the overlay's lifetime (lazy GL resources inside).
  useEffect(() => {
    occluderRef.current = new GripDepthOccluder();
    return () => {
      occluderRef.current?.dispose();
      occluderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasGrips) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [hasGrips, draw]);

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
