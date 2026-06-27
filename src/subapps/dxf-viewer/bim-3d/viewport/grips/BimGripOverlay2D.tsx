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

import { useRef, useSyncExternalStore, useCallback, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import { UnifiedGripRenderer } from '../../../rendering/grips';
import type { GripSettings } from '../../../rendering/grips/types';
import type { Point2D } from '../../../rendering/types/Types';
import type { GripInfo } from '../../../hooks/grip-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { getGripPreviewStyle } from '../../../hooks/useGripPreviewStyle';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { buildTwinSurfaceConfigs } from '../../grips/grip-3d-twin-overlay';
import { buildDxfGhostSegments } from '../../grips/dxf-grip-ghost-paint';
import { collectCoincidentLinePartnerMoves } from '../../../systems/stretch/coincident-endpoint-comove';
import type { StretchVertexMove } from '../../../core/commands/entity-commands/StretchEntityCommand';
import type { Entity } from '../../../types/entities';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { findDxfEntityInScope } from '../../scene/dxf-3d-floor-scope';
import { dxfPlanToWorld } from '../coordinate-transforms';
import { sizeCanvasToContainerDpr } from '../../../rendering/canvas/withCanvasState';
import { useRafWhile, useCameraMotionGate, useGripDepthOccluder } from '../overlay-raf';
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';

export interface BimGripOverlay2DProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

/** ADR-537 — raw DXF live-ghost stroke (Revit-blue dashed, mirror the cold grip hue). */
const DXF_GHOST_STROKE = 'rgba(80, 160, 255, 0.9)';

/** Stroke a set of plan-mm poly-lines through `project` with the Revit-blue dashed ghost style. */
function strokeGhostSegments(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  segments: Point2D[][],
): void {
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

/**
 * ADR-537 — stroke the live ghost of a raw DXF entity being grip-dragged. Reads the dragged
 * grip (its own `entityId` is the source — robust to multi-line selections, ADR-543) + the
 * live drag (non-reactive singleton); builds the entity-in-progress geometry via the pure
 * `buildDxfGhostSegments` and projects with the SAME projector the grips use (pixel-for-pixel).
 * No-op for BIM grips (`dxfGhostEntityIds` empty) or when no drag is in flight. ADR-543 — also
 * strokes the coincident PARTNER lines reshaping (articulated joint co-move preview).
 */
function paintDxfGhost(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  grips: readonly GripInfo[],
): void {
  const ids = useGrip3DOverlayStore.getState().dxfGhostEntityIds;
  const drag = grip3DOverlayInteraction.drag;
  if (ids.length === 0 || !drag || grips.length === 0) return;
  const grip = grips[drag.index % grips.length];
  if (!grip?.entityId) return;
  // ADR-537 δ — resolve across the active floor scope (the dragged entity may be on a stacked
  // floor, not the active one). The ghost's elevation rides the seated `topElevFor` already.
  const found = findDxfEntityInScope(grip.entityId);
  if (!found) return;
  // ADR-537 γ — scale native DXF coords to mm (this floor's factor) so the ghost aligns with grips.
  strokeGhostSegments(ctx, project,
    buildDxfGhostSegments(found.entity, grip, drag.livePlanPos, dxfSceneUnitToMm(found.scene)));
  paintPartnerGhosts(ctx, project, found.entity, grip, drag.livePlanPos, ids);
}

/** The dragged endpoint's vertex kind, or null when it is not a single line endpoint. */
function draggedLineEndpointKind(grip: GripInfo): 'line-start' | 'line-end' | null {
  if (grip.movesEntity) return null;
  if (grip.gripIndex === 0) return 'line-start';
  if (grip.gripIndex === 1) return 'line-end';
  return null;
}

/**
 * ADR-543 — synthesize a ghost grip for a coincident partner line so `buildDxfGhostSegments`
 * reshapes the partner's matching endpoint(s) by the same `deltaMm`. The grip `position` is
 * irrelevant (only `livePlanPos − position = deltaMm` drives the move), so it is left at the
 * origin and `livePlanPos = deltaMm`. Both endpoints coincident ⇒ a whole-entity (midpoint) grip.
 */
function buildPartnerGhostGrip(move: StretchVertexMove, deltaMm: Point2D): { grip: GripInfo; live: Point2D } {
  const hasStart = move.refs.some((r) => r.kind === 'line-start');
  const hasEnd = move.refs.some((r) => r.kind === 'line-end');
  const whole = hasStart && hasEnd;
  const grip: GripInfo = {
    entityId: move.entityId,
    gripIndex: whole ? 2 : hasStart ? 0 : 1,
    type: whole ? 'edge' : 'vertex',
    position: { x: 0, y: 0 },
    movesEntity: whole,
    ...(whole ? { edgeVertexIndices: [0, 1] as [number, number] } : {}),
  };
  return { grip, live: { x: deltaMm.x, y: deltaMm.y } };
}

/** ADR-543 — stroke each coincident partner line reshaping by the same world delta as the dragged line. */
function paintPartnerGhosts(
  ctx: CanvasRenderingContext2D,
  project: (p: Point2D) => Point2D,
  draggedEntity: DxfEntityUnion,
  grip: GripInfo,
  livePlanPos: Point2D,
  ids: readonly string[],
): void {
  if (ids.length < 2) return;
  const kind = draggedLineEndpointKind(grip);
  if (!kind || draggedEntity.type !== 'line') return;
  const deltaMm = { x: livePlanPos.x - grip.position.x, y: livePlanPos.y - grip.position.y };
  const partnerMoves = collectCoincidentLinePartnerMoves({
    draggedEntity: draggedEntity as unknown as Entity,
    draggedRefs: [{ entityId: draggedEntity.id, kind }],
    selectedEntityIds: ids,
    getEntity: (id) => findDxfEntityInScope(id)?.entity as unknown as Entity | undefined,
  });
  for (const move of partnerMoves) {
    const found = findDxfEntityInScope(move.entityId);
    if (!found || found.entity.type !== 'line') continue;
    const { grip: synth, live } = buildPartnerGhostGrip(move, deltaMm);
    strokeGhostSegments(ctx, project, buildDxfGhostSegments(found.entity, synth, live, dxfSceneUnitToMm(found.scene)));
  }
}

export function BimGripOverlay2D({ managerRef }: BimGripOverlay2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ADR-535 Φ5b — GPU depth-occluder via το shared lifecycle SSoT (overlay-raf, ADR-544 dedup).
  const occluderRef = useGripDepthOccluder();
  // ADR-535/536 — HIDE grips during camera motion (orbit/zoom/pan): while moving, the occluder's
  // full-scene depth pre-pass + the 2D draws are skipped → the grips vanish and navigation stays
  // smooth; they snap back with correct occlusion the instant the camera settles (the continuous
  // RAF guarantees that settle frame). Big-player CAD/BIM «hide handles during navigation» —
  // shared SSoT with the snap overlay (ADR-542 `useCameraMotionGate`).
  const isCameraMoving = useCameraMotionGate();

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

    // Size the overlay canvas to the viewport at DPR + clear (shared SSoT). Work in CSS px (the
    // projector returns CSS-px canvas-local coords); the renderer's 7px grip is then real 7 CSS
    // px, identical to the 2D canvas (which also uses dpiScale 1).
    const ctx = sizeCanvasToContainerDpr(canvas, container);
    if (!ctx) return;

    // ADR-535/536 — skip everything (occluder depth pre-pass + 2D draws) while the camera
    // moves: grips vanish during orbit/zoom/pan, snap back (correctly occluded) on settle.
    if (isCameraMoving(camera)) return; // canvas already cleared above → grips hidden during motion

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
    // ADR-535 Φ5b/Φ6 occlusion applies to BIM solids (grips on top/bottom faces of 3D bodies).
    // ADR-537 — a RAW DXF selection is a FLAT underlay: every grip lies on ONE floor plane, so
    // depth-occlusion only mis-culls them (a coplanar floor-level grip at a grazing view angle, or
    // a grip sitting over any BIM solid that the flat underlay is referenced against). The 2D canvas
    // has no grip occlusion either → match it: skip occlusion for raw DXF, keep it for BIM.
    const isRawDxfSelection = useGrip3DOverlayStore.getState().dxfGhostEntityIds.length > 0;
    const occluder = occluderRef.current;
    let visibility: readonly boolean[] | null = null;
    if (occluder && !isRawDxfSelection) {
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
  }, [managerRef, isCameraMoving]);

  // Clear the canvas when the grip set empties / on unmount (shared overlay RAF SSoT, ADR-542).
  const onStop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);
  useRafWhile(hasGrips, draw, onStop);

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
