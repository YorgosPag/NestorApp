'use client';

/**
 * use-grip-pass — the 3D reshape-grip layer of the unified overlay dispatch (ADR-555). Carries the
 * EXACT draw of the former `BimGripOverlay2D` (ADR-535 Φ5/Φ6, ADR-537/543): projects every grip's
 * plan point through the live camera with `makeGripPlanToCanvas` and paints the SAME 2D
 * `UnifiedGripRenderer` with the SAME `getGripPreviewStyle` settings — so the 3D grips are
 * byte-identical to the 2D canvas grips. The size/clear/camera/motion-gate boilerplate moved to the
 * shared dispatch (`paintBimOverlayFrame`); only the verbatim paint + the low-frequency activation
 * subscription live here.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the low-frequency grip set (drives the dispatch RAF on/off);
 * the high-frequency hover index + live drag position are read imperatively from the non-reactive
 * `grip3DOverlayInteraction` each frame (zero re-render).
 */

import { useSyncExternalStore } from 'react';
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
import { useGrip3DOverlayStore, grip3DOverlayInteraction } from '../../stores/Grip3DOverlayStore';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

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
 * ADR-537 — stroke the live ghost of a raw DXF entity being grip-dragged. Reads the dragged grip
 * (its own `entityId` is the source — robust to multi-line selections, ADR-543) + the live drag
 * (non-reactive singleton); builds the entity-in-progress geometry via the pure `buildDxfGhostSegments`
 * and projects with the SAME projector the grips use (pixel-for-pixel). No-op for BIM grips
 * (`dxfGhostEntityIds` empty) or when no drag is in flight.
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
  const found = findDxfEntityInScope(grip.entityId);
  if (!found) return;
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
 * reshapes the partner's matching endpoint(s) by the same `deltaMm`.
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

/**
 * ADR-535 Φ5b/Φ6 — Revit / Maxon (Cinema 4D) grade depth occlusion over the 2N twin squares (first
 * N = top faces, next N = bottom faces). A square behind a solid surface is culled on the GPU. Raw
 * DXF selections are a FLAT underlay (every grip on one plane → depth-occlusion only mis-culls them),
 * so occlusion is skipped for raw DXF, kept for BIM — matching the 2D canvas (no grip occlusion). The
 * occluder publishes per-flat-index visibility to the shared non-reactive state for the controller's
 * hit-test. Returns null when there is no occluder or for a raw DXF selection.
 */
function computeGripVisibility(
  frame: BimOverlayFrame,
  liveGrips: readonly GripInfo[],
  topElevFor: (p: Point2D) => number,
  bottomElevFor: (p: Point2D) => number,
): readonly boolean[] | null {
  const isRawDxfSelection = useGrip3DOverlayStore.getState().dxfGhostEntityIds.length > 0;
  const { occluder, manager, camera } = frame;
  if (!occluder || isRawDxfSelection) return null;
  const worlds = [
    ...liveGrips.map((g) => dxfPlanToWorld(g.position.x, g.position.y, topElevFor(g.position))),
    ...liveGrips.map((g) => dxfPlanToWorld(g.position.x, g.position.y, bottomElevFor(g.position))),
  ];
  return occluder.computeVisibility(manager.renderer, manager.scene, camera, worlds);
}

/** EXACT 2D grip settings SSoT (mirror `GripPhaseRenderer.renderStandardGrips`). */
function gripRenderSettings(): Partial<GripSettings> {
  const style = getGripPreviewStyle();
  return { colors: style.colors, gripSize: style.gripSize, dpiScale: 1.0 };
}

/** One dispatch frame for the grip layer — projects + paints the twin grip surfaces (ADR-535 Φ6). */
function paintGripOverlay(frame: BimOverlayFrame): void {
  const { ctx, camera, canvas } = frame;
  const { grips: liveGrips, topElevFor, bottomElevFor } = useGrip3DOverlayStore.getState();
  const n = liveGrips.length;
  if (n === 0) return;

  const projectTop = makeGripPlanToCanvas(camera, canvas, topElevFor);
  const projectBottom = makeGripPlanToCanvas(camera, canvas, bottomElevFor);
  const { hoverIndex, drag } = grip3DOverlayInteraction;

  const visibility = computeGripVisibility(frame, liveGrips, topElevFor, bottomElevFor);
  grip3DOverlayInteraction.visibility = visibility;
  const ov = { hoverIndex, dragIndex: drag?.index ?? null, dragLivePlanPos: drag?.livePlanPos ?? null, visibility };
  const settings = gripRenderSettings();

  // ADR-537 — raw DXF live ghost (entity-in-progress) UNDER the grip squares.
  paintDxfGhost(ctx, projectTop, liveGrips);
  // Top pass (flat offset 0) + bottom pass (flat offset N), each through its own projector.
  new UnifiedGripRenderer(ctx, projectTop).renderGripSetBatched(buildTwinSurfaceConfigs(liveGrips, 0, ov), settings);
  new UnifiedGripRenderer(ctx, projectBottom).renderGripSetBatched(buildTwinSurfaceConfigs(liveGrips, n, ov), settings);
}

/**
 * The grip layer as a dispatch pass. Active while the low-frequency grip set is non-empty;
 * hides during camera motion (the occluder pre-pass + draws are skipped, grips snap back on settle).
 */
export function useGripPass(): BimOverlayPass {
  const grips = useSyncExternalStore(
    useGrip3DOverlayStore.subscribe,
    () => useGrip3DOverlayStore.getState().grips,
    () => useGrip3DOverlayStore.getState().grips,
  );
  return { active: grips.length > 0, hideOnMotion: true, paint: paintGripOverlay };
}
