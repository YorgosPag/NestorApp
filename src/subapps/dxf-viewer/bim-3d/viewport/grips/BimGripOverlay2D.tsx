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
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { UnifiedGripRenderer } from '../../../rendering/grips';
import type { GripRenderConfig, GripSettings } from '../../../rendering/grips/types';
import { getGripPreviewStyle } from '../../../hooks/useGripPreviewStyle';
import { dxfPlanToWorld } from '../../viewport/coordinate-transforms';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { isGripOccluded } from '../../grips/grip-3d-occlusion';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';

export interface BimGripOverlay2DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function BimGripOverlay2D({ managerRef }: BimGripOverlay2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

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

    const { grips: liveGrips, elevFor } = useGrip3DOverlayStore.getState();
    if (liveGrips.length === 0) return;

    const project = makeGripPlanToCanvas(camera, canvas, elevFor);
    const { hoverIndex, drag } = grip3DOverlayInteraction;
    // ADR-535 Φ5 — depth occlusion: only front-most grips show (Giorgio). Grips hidden
    // behind BIM geometry are culled; the actively dragged grip is always drawn.
    const occluders = manager.bimLayer.group;

    // EXACT 2D settings SSoT (mirror `GripPhaseRenderer.renderStandardGrips`).
    const style = getGripPreviewStyle();
    const settings: Partial<GripSettings> = {
      colors: style.colors,
      gripSize: style.gripSize,
      dpiScale: 1.0,
    };

    const configs: GripRenderConfig[] = [];
    for (let i = 0; i < liveGrips.length; i++) {
      const grip = liveGrips[i];
      const dragging = drag?.index === i;
      // The dragged square rides its snapped live position; the rest sit at the footprint.
      const position = dragging ? drag!.livePlanPos : grip.position;
      // Cull grips hidden behind geometry (never the dragged one — it leads the edit).
      if (!dragging && isGripOccluded(dxfPlanToWorld(position.x, position.y, elevFor(position)), camera, occluders)) {
        continue;
      }
      const temperature = dragging ? 'hot' : hoverIndex === i ? 'warm' : 'cold';
      configs.push({
        position,
        type: (grip.type ?? 'vertex') as GripRenderConfig['type'],
        temperature,
        // Footprint grips carry no shape hint → the AutoCAD square, like the 2D slab grips.
        shape: 'square',
      });
    }

    new UnifiedGripRenderer(ctx, project).renderGripSetBatched(configs, settings);
  }, [managerRef]);

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
