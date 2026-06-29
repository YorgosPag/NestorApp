'use client';

/**
 * use-hover-glow-pass — the DXF hover-glow layer of the unified overlay dispatch (ADR-555). Carries
 * the EXACT draw of the former `DxfHoverGlowOverlay2D` (ADR-538/549 Φ2/Φ3): projects the hovered raw
 * DXF entity's outline through the live camera (`makeGripPlanToCanvas`, flat) and strokes the SAME 2D
 * yellow glow SSoT (`drawEntityGlowPrePass` + `HOVER_HIGHLIGHT.ENTITY`) — so a hovered DXF
 * line/polyline/circle/arc lights up in 3D byte-identically to the 2D plan. BIM meshes get the WebGL
 * silhouette instead (SelectionOutlinePass), not this layer.
 *
 * ADR-549 Φ3 — the glow is identical frame-to-frame while the SAME entity is hovered with a STATIC
 * camera, so this pass reports `isDirty=false` then; the shared dispatch skips the frame entirely (no
 * clear, no GPU re-upload) → the crosshair keeps painting without the «hover lag». Camera motion is
 * handled by the dispatch's frame-level gate; this pass sets `hideOnMotion=false` so the glow keeps
 * following the entity during orbit (its pre-merge behaviour), and the frame-level `moving` forces the
 * repaint.
 *
 * ADR-040 micro-leaf: subscribes ONLY to `hoveredEntityId` (drives the dispatch RAF on/off); the
 * geometry is read imperatively each frame.
 */

import { useRef, useSyncExternalStore, useCallback, useMemo, type MutableRefObject } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { drawEntityGlowPrePass } from '../../../rendering/entities/base-entity-style-helpers';
import { getHoveredEntity, subscribeHoveredEntity } from '../../../systems/hover/HoverStore';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfEntityOutlineSegments } from '../../grips/dxf-entity-outline';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { findDxfEntityInScope } from '../../scene/dxf-3d-floor-scope';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** Stroke each projected plan poly-line (the glow style is already set by `drawEntityGlowPrePass`). */
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

/** Last painted glow identity — the hovered id + container size, for the ADR-549 Φ3 dirty check. */
interface LastDrawn {
  readonly id: string;
  readonly w: number;
  readonly h: number;
}

/**
 * The DXF hover-glow layer as a dispatch pass. `active` resolves DXF-ness once per hover change (NOT
 * per frame) so the dispatch RAF stays OFF for a BIM hover. `isDirty` reproduces ADR-549 Φ3 (skip
 * when the same entity is hovered at the same size; camera handled by the dispatch motion gate).
 */
export function useHoverGlowPass(containerRef: MutableRefObject<HTMLElement | null>): BimOverlayPass {
  const hoveredId = useSyncExternalStore(subscribeHoveredEntity, getHoveredEntity, getHoveredEntity);
  // ADR-549 Φ2 — the glow is ONLY for raw DXF entities (BIM meshes get the WebGL silhouette).
  const active = useMemo(() => hoveredId !== null && findDxfEntityInScope(hoveredId) !== null, [hoveredId]);
  const lastDrawnRef = useRef<LastDrawn | null>(null);

  const isDirty = useCallback((): boolean => {
    const id = getHoveredEntity();
    const c = containerRef.current;
    const prev = lastDrawnRef.current;
    return !(prev && prev.id === id && prev.w === (c?.clientWidth ?? 0) && prev.h === (c?.clientHeight ?? 0));
  }, [containerRef]);

  const paint = useCallback((frame: BimOverlayFrame): void => {
    const { ctx, camera, canvas } = frame;
    const id = getHoveredEntity();
    if (!id) { lastDrawnRef.current = null; return; }
    // ADR-537 δ — resolve across the active floor scope (the hovered entity may be on a stacked floor).
    const found = findDxfEntityInScope(id);
    if (!found) { lastDrawnRef.current = null; return; }
    // ADR-537 γ — scale native DXF coords to mm so the glow aligns with the mm plan projector.
    const segments = dxfEntityOutlineSegments(found.entity, dxfSceneUnitToMm(found.scene));
    if (segments.length === 0) { lastDrawnRef.current = null; return; }
    const project = makeGripPlanToCanvas(camera, canvas, () => found.floorElevationMm);
    // Reuse the EXACT 2D glow SSoT: the yellow halo is drawn by stroking the projected outline.
    drawEntityGlowPrePass(ctx, { lineWidth: found.entity.lineWidth }, () => strokeSegments(ctx, project, segments));
    const c = containerRef.current;
    lastDrawnRef.current = { id, w: c?.clientWidth ?? 0, h: c?.clientHeight ?? 0 };
  }, [containerRef]);

  return useMemo(
    () => ({ active, hideOnMotion: false, isDirty, paint }),
    [active, isDirty, paint],
  );
}
