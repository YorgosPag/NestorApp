'use client';

/**
 * DxfHoverGlowOverlay2D — Canvas2D overlay that draws the 2D hover GLOW on a raw DXF
 * entity that is hovered in the 3D viewport (ADR-538), using the EXACT 2D SSoT
 * (`drawEntityGlowPrePass` + `HOVER_HIGHLIGHT.ENTITY`). Mirror of `BimGripOverlay2D`:
 * a `pointer-events-none` canvas absolutely positioned over the WebGL viewport; each RAF
 * frame it reads the live camera, projects the hovered entity's outline to canvas-local
 * px (`makeGripPlanToCanvas`, flat Y=0) and strokes the yellow glow — so a hovered DXF
 * line/polyline/circle/arc lights up in 3D byte-identically to the 2D plan.
 *
 * Hover STATE is the unified `HoverStore` (the SAME store the 2D canvas writes). BIM
 * meshes are NOT handled here — they get the yellow 3D silhouette (SelectionOutlinePass).
 *
 * ADR-040 micro-leaf: subscribes ONLY to `hoveredEntityId` (drives the RAF on/off); the
 * geometry is read imperatively each frame.
 */

import { useRef, useSyncExternalStore, useCallback, useMemo, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import type { Point2D } from '../../../rendering/types/Types';
import { drawEntityGlowPrePass } from '../../../rendering/entities/base-entity-style-helpers';
import { getHoveredEntity, subscribeHoveredEntity } from '../../../systems/hover/HoverStore';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfEntityOutlineSegments } from '../../grips/dxf-entity-outline';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { findDxfEntityInScope } from '../../scene/dxf-3d-floor-scope';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';
import { useRafWhile, useCameraMotionGate } from '../overlay-raf';

export interface DxfHoverGlowOverlay2DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function DxfHoverGlowOverlay2D({ managerRef }: DxfHoverGlowOverlay2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ADR-040 — subscribe ONLY to the hovered entity id (drives the RAF on/off).
  const hoveredId = useSyncExternalStore(subscribeHoveredEntity, getHoveredEntity, getHoveredEntity);
  // ADR-549 Φ2 — the glow is ONLY for raw DXF entities (BIM meshes get the WebGL silhouette). Resolve
  // DXF-ness once per hover change (NOT per frame) so the RAF stays OFF for a BIM hover — otherwise it
  // would clear the full-DPR overlay canvas every frame for a no-op draw.
  const active = useMemo(() => hoveredId !== null && findDxfEntityInScope(hoveredId) !== null, [hoveredId]);

  // ADR-549 Φ3 — redraw-on-demand: the glow outline is identical frame-to-frame while the SAME
  // entity is hovered with a STATIC camera, so skip the redraw then. Re-clearing + re-stroking +
  // re-uploading a full-DPR canvas texture EVERY frame (the old `useRafWhile` behaviour) was GPU
  // compositing work that delayed the crosshair's paint → the cursor «lagged» while hovering.
  const isCameraMoving = useCameraMotionGate();
  const lastDrawnRef = useRef<{ id: string; w: number; h: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!canvas || !container || !manager) return;
    const camera = manager.getCamera();
    if (!camera) return;

    // Resolve the hovered id to a RAW DXF entity (BIM ids are absent → no-op here).
    const id = getHoveredEntity();
    if (!id) return;

    // Skip the frame entirely when nothing that affects the glow changed (camera gate called ONCE
    // per frame, per overlay-raf SSoT). The canvas keeps the last frame's pixels — no GPU re-upload.
    const moved = isCameraMoving(camera);
    const w = container.clientWidth;
    const h = container.clientHeight;
    const prev = lastDrawnRef.current;
    if (!moved && prev && prev.id === id && prev.w === w && prev.h === h) return;

    // Size the overlay canvas to the viewport at DPR + clear (shared SSoT).
    const ctx = sizeCanvasToContainerDpr(canvas, container);
    if (!ctx) return;

    // ADR-537 δ — resolve across the active floor scope (the hovered entity may be on a stacked
    // floor). Carries the floor elevation (project the glow at the right Y) + scene (unit scale).
    const found = findDxfEntityInScope(id);
    if (!found) { lastDrawnRef.current = null; return; }
    // ADR-537 γ — scale native DXF coords to mm so the glow aligns with the mm plan projector.
    const segments = dxfEntityOutlineSegments(found.entity, dxfSceneUnitToMm(found.scene));
    if (segments.length === 0) { lastDrawnRef.current = null; return; }

    const project = makeGripPlanToCanvas(camera, canvas, () => found.floorElevationMm);
    // Reuse the EXACT 2D glow SSoT: the yellow halo is drawn by stroking the projected outline.
    drawEntityGlowPrePass(ctx, { lineWidth: found.entity.lineWidth }, () => strokeSegments(ctx, project, segments));
    lastDrawnRef.current = { id, w, h };
  }, [managerRef, isCameraMoving]);

  // Clear the glow when the hover ends / on unmount (shared overlay RAF SSoT, ADR-542).
  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastDrawnRef.current = null;
  }, []);
  useRafWhile(active, draw, onStop, 'hover-glow'); // 🔬 ADR-549 Phase 0

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

/** Stroke each projected plan poly-line (the glow style is already set by drawEntityGlowPrePass). */
function strokeSegments(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  segments: readonly Point2D[][],
): void {
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
}
