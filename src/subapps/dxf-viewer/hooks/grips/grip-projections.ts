/**
 * ADR-183: Grip Projections — Pure builders for backward-compatible projections
 *
 * Converts unified grip state → DXF projection + Overlay projection.
 * Extracted from useUnifiedGripInteraction (Google SRP).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  DxfGripDragPreview,
  DxfGripInteractionState,
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  OverlayProjection,
} from './unified-grip-types';
import type { HotGripStep } from './wall-hot-grip-fsm';
import { applyGripStepSnap } from '../../bim/grips/grip-step-quantize';
import { applyMoveConstraints } from '../../bim/grips/grip-move-constraints';

// ── ADR-397 Σ3 — pure rotate-angle helpers (typed angle ⇄ world delta) ──

/**
 * World delta for a typed rotation of `deg` (signed, +CCW) about a pivot, using a
 * unit East reference: `anchor = pivot + (1,0)`, so `anchor + delta = pivot +
 * (cos,sin)`. `apply*GripDrag` then sweeps EXACTLY `deg` around the pivot.
 */
export function rotateDeltaForAngleDeg(deg: number): Point2D {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad) - 1, y: Math.sin(rad) };
}

/**
 * Signed sweep (degrees, +CCW/−CW) from the reference arm to the align arm,
 * normalized to (−180, 180]. Both vectors are pivot-relative (refDir, alignDir).
 */
export function rotateSweepDegFromDirs(refDir: Point2D, alignDir: Point2D): number {
  const a = Math.atan2(alignDir.y, alignDir.x) - Math.atan2(refDir.y, refDir.x);
  let deg = (a * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return deg;
}

// ── DXF Projection Builders ──

export function buildDxfDragPreview(
  phase: UnifiedGripPhase,
  activeGrip: UnifiedGripInfo | null,
  anchorPos: Point2D | null,
  currentWorldPos: Point2D | null,
  altMove = false,
  hotGripMove = false,
): DxfGripDragPreview | null {
  // ADR-363 Phase 1G — `hotGrip` reuses the same preview pipeline as `dragging`
  // (live ghost + delta) so the corner click-click move shows the same wall ghost.
  if ((phase !== 'dragging' && phase !== 'hotGrip') || !activeGrip || activeGrip.source !== 'dxf' || !anchorPos || !currentWorldPos) {
    return null;
  }
  const rawDelta = { x: currentWorldPos.x - anchorPos.x, y: currentWorldPos.y - anchorPos.y };
  // ORTHO (F8) applies only when the WHOLE entity translates (Alt move-from-base /
  // a `movesEntity` grip / a wall "move" hot-grip) — parametric resize grips keep
  // their own geometry and get only SNAP-MODE step. ORTHO first, then step (the
  // commit runs the identical `applyMoveConstraints`, so ghost == result).
  const movesWhole = altMove || activeGrip.movesEntity === true || hotGripMove;
  const delta = movesWhole ? applyMoveConstraints(rawDelta) : applyGripStepSnap(rawDelta);
  // ADR-363 Phase 1G.5 — Alt «move-from-characteristic-point»: emit a parametric-
  // kind-free snapshot with `movesEntity: true` so `applyEntityPreview` translates
  // the WHOLE entity by `delta` (via the move SSoT) instead of running a corner /
  // thickness / resize parametric ghost. The grabbed grip is the base point.
  if (altMove) {
    // `anchorPos` (the grabbed grip = base point) lets the ghost resolve a hosted
    // opening's slide / re-host against the host wall (ADR-363 Φ1G.5 Slice 2);
    // free entities ignore it.
    return { entityId: activeGrip.entityId!, gripIndex: activeGrip.gripIndex, delta, movesEntity: true, anchorPos };
  }
  return {
    entityId: activeGrip.entityId!,
    gripIndex: activeGrip.gripIndex,
    delta,
    movesEntity: activeGrip.movesEntity,
    edgeVertexIndices: activeGrip.edgeVertexIndices,
    // ADR-363 — the grabbed grip world position = the drag base point. Always emitted so the
    // live move-distance readout (useGripGhostPreview) can draw base→current even for a plain
    // whole-entity move grip (e.g. a line's midpoint grip) that carries no parametric kind.
    anchorPos,
    // ADR-363 Phase 1G — flag the dashed rubber-band leader for the corner hot-grip.
    ...(phase === 'hotGrip' ? { hotGrip: true } : {}),
    // ADR-358 Phase 5d — propagate parametric stair discriminator + anchor
    // so `applyEntityPreview` can reach `applyStairGripDrag` with the same
    // inputs the commit adapter uses (origin/delta/currentPos).
    ...(activeGrip.stairGripKind ? { stairGripKind: activeGrip.stairGripKind } : {}),
    ...(activeGrip.stairGripKind ? { anchorPos } : {}),
    // ADR-363 Phase 1C — parametric wall grip discriminator + anchor.
    ...(activeGrip.wallGripKind ? { wallGripKind: activeGrip.wallGripKind, anchorPos } : {}),
    // ADR-363 Phase 4.5c.5 — propagate column/beam grip kind so the dim-annotation
    // leaf can compute live "w=350mm" labels without re-subscribing to scene state.
    ...(activeGrip.columnGripKind ? { columnGripKind: activeGrip.columnGripKind } : {}),
    ...(activeGrip.beamGripKind   ? { beamGripKind:   activeGrip.beamGripKind }   : {}),
    ...((activeGrip.columnGripKind ?? activeGrip.beamGripKind) ? { anchorPos } : {}),
    // ADR-436 Slice 1b — foundation grip kind + anchor for live resize/rotate ghost + "w=/l=" label.
    ...(activeGrip.foundationGripKind ? { foundationGripKind: activeGrip.foundationGripKind, anchorPos } : {}),
    // ADR-406 — MEP fixture grip kind + anchor for the live corner/move/rotate ghost.
    ...(activeGrip.mepFixtureGripKind ? { mepFixtureGripKind: activeGrip.mepFixtureGripKind, anchorPos } : {}),
    // ADR-408 Φ3 — electrical panel grip kind + anchor for the live corner/move/rotate ghost.
    ...(activeGrip.electricalPanelGripKind ? { electricalPanelGripKind: activeGrip.electricalPanelGripKind, anchorPos } : {}),
    // ADR-408 Φ12 — MEP manifold grip kind + anchor for the live corner/move/rotate ghost.
    ...(activeGrip.mepManifoldGripKind ? { mepManifoldGripKind: activeGrip.mepManifoldGripKind, anchorPos } : {}),
    // ADR-408 Φ8 — MEP segment grip kind + anchor for the live midpoint-move / drag ghost.
    ...(activeGrip.mepSegmentGripKind ? { mepSegmentGripKind: activeGrip.mepSegmentGripKind, anchorPos } : {}),
    // ADR-410 — furniture grip kind + anchor for the live corner/move/rotate ghost.
    ...(activeGrip.furnitureGripKind ? { furnitureGripKind: activeGrip.furnitureGripKind, anchorPos } : {}),
    // ADR-415 — floorplan-symbol grip kind + anchor for the live ghost.
    ...(activeGrip.floorplanSymbolGripKind ? { floorplanSymbolGripKind: activeGrip.floorplanSymbolGripKind, anchorPos } : {}),
    // ADR-363 Phase 3.5 / 3.7a / 2.5 — slab / slab-opening / opening grip kinds.
    ...(activeGrip.slabGripKind        ? { slabGripKind:        activeGrip.slabGripKind,        anchorPos } : {}),
    ...(activeGrip.slabOpeningGripKind ? { slabOpeningGripKind: activeGrip.slabOpeningGripKind, anchorPos } : {}),
    ...(activeGrip.openingGripKind     ? { openingGripKind:     activeGrip.openingGripKind,     anchorPos } : {}),
    // ADR-417 Φ1-part-2 #2 — roof grip kind + anchor for the live footprint ghost.
    ...(activeGrip.roofGripKind        ? { roofGripKind:        activeGrip.roofGripKind,        anchorPos } : {}),
  };
}

/**
 * ADR-363 Phase 1G.3 — live preview for the wall-rotation 6-click reference flow.
 *
 * Drives two things off the hot-grip refs:
 *  - dashed guide segments (`rotateRefLine` / `rotateAlignLine`) drawn on the
 *    preview canvas so the user sees the reference + alignment lines being traced;
 *  - the rotating wall ghost (during the final `await-align-end` step only), by
 *    re-using the existing delta+pivot ghost pipeline via the identity
 *    `anchor = pivot + refDir`, `currentPos = pivot + alignDir` so
 *    `applyWallGripDrag('wall-rotation', …)` sweeps `angle(align) − angle(ref)`.
 *
 * Returns null until the centre is picked and there is a segment to show (the
 * `await-base` / `await-ref-start` steps draw nothing).
 */
export function buildRotateReferencePreview(
  activeGrip: UnifiedGripInfo | null,
  step: HotGripStep,
  pivot: Point2D | null,
  refStart: Point2D | null,
  refEnd: Point2D | null,
  alignStart: Point2D | null,
  cursor: Point2D | null,
  // ADR-397 — FREE rotate baseline (cursor at the first move after the centre).
  // Drives the `rotate-free` live ghost; null until that first move (pivot ⊙ only).
  freeBaseline: Point2D | null = null,
  // ADR-397 Σ3 — typed angle (signed deg, +CCW). When set it OVERRIDES the cursor
  // sweep so the ghost snaps to the keyed-in value; null → live cursor rotate.
  typedAngleDeg: number | null = null,
): DxfGripDragPreview | null {
  if (!activeGrip || activeGrip.source !== 'dxf' || !pivot) return null;
  const base = {
    entityId: activeGrip.entityId!,
    gripIndex: activeGrip.gripIndex,
    movesEntity: activeGrip.movesEntity,
    // ADR-397 / ADR-406 — forward whichever parametric kind owns the rotation
    // handle so the live ghost reaches the right `apply*GripDrag` (wall / beam /
    // column / mep-fixture 6-click rotate).
    ...(activeGrip.wallGripKind ? { wallGripKind: activeGrip.wallGripKind } : {}),
    ...(activeGrip.beamGripKind ? { beamGripKind: activeGrip.beamGripKind } : {}),
    ...(activeGrip.columnGripKind ? { columnGripKind: activeGrip.columnGripKind } : {}),
    // ADR-436 Slice 1b — foundation pad 6-click rotate live ghost.
    ...(activeGrip.foundationGripKind ? { foundationGripKind: activeGrip.foundationGripKind } : {}),
    ...(activeGrip.mepFixtureGripKind ? { mepFixtureGripKind: activeGrip.mepFixtureGripKind } : {}),
    ...(activeGrip.electricalPanelGripKind ? { electricalPanelGripKind: activeGrip.electricalPanelGripKind } : {}),
    // ADR-408 Φ12 — MEP manifold 6-click rotate live ghost.
    ...(activeGrip.mepManifoldGripKind ? { mepManifoldGripKind: activeGrip.mepManifoldGripKind } : {}),
    // ADR-408 Φ8 — MEP segment 6-click rotate live ghost.
    ...(activeGrip.mepSegmentGripKind ? { mepSegmentGripKind: activeGrip.mepSegmentGripKind } : {}),
    // ADR-410 — furniture 6-click rotate live ghost.
    ...(activeGrip.furnitureGripKind ? { furnitureGripKind: activeGrip.furnitureGripKind } : {}),
    // ADR-415 — floorplan-symbol 6-click rotate live ghost.
    ...(activeGrip.floorplanSymbolGripKind ? { floorplanSymbolGripKind: activeGrip.floorplanSymbolGripKind } : {}),
    hotGrip: true as const,
    rotatePivot: pivot,
    delta: { x: 0, y: 0 },
    anchorPos: pivot,
  };
  // ADR-397 — FREE rotate live ghost (Revit/AutoCAD default). Same identity as the
  // reference flow: anchor = pivot + refDir, delta = alignDir − refDir, so
  // `apply*GripDrag('*-rotation', …)` sweeps `angle(align) − angle(ref)` = the cursor
  // sweep around the centre. refDir = baseline − pivot, alignDir = cursor − pivot.
  // No baseline yet → centre is locked but no sweep (pivot ⊙ only).
  if (step === 'rotate-free') {
    // ADR-397 Σ3 — a typed angle overrides the cursor sweep (exact, signed +CCW).
    // Anchor on a unit East reference so the ghost rotates by EXACTLY the typed deg.
    if (typedAngleDeg != null) {
      return {
        ...base,
        anchorPos: { x: pivot.x + 1, y: pivot.y },
        delta: rotateDeltaForAngleDeg(typedAngleDeg),
        rotateSweepDeg: typedAngleDeg,
        rotateReadoutAnchor: cursor ?? pivot,
      };
    }
    if (!freeBaseline || !cursor) return base;
    const refDir = { x: freeBaseline.x - pivot.x, y: freeBaseline.y - pivot.y };
    const alignDir = { x: cursor.x - pivot.x, y: cursor.y - pivot.y };
    return {
      ...base,
      anchorPos: { x: pivot.x + refDir.x, y: pivot.y + refDir.y },
      delta: { x: alignDir.x - refDir.x, y: alignDir.y - refDir.y },
      rotateSweepDeg: rotateSweepDegFromDirs(refDir, alignDir),
      rotateReadoutAnchor: cursor,
    };
  }
  if (step === 'await-ref-end' && refStart && cursor) {
    return { ...base, rotateRefLine: { from: refStart, to: cursor } };
  }
  if (step === 'await-align-start' && refStart && refEnd) {
    return { ...base, rotateRefLine: { from: refStart, to: refEnd } };
  }
  if (step === 'await-align-end' && refStart && refEnd && alignStart && cursor) {
    const refDir = { x: refEnd.x - refStart.x, y: refEnd.y - refStart.y };
    const alignDir = { x: cursor.x - alignStart.x, y: cursor.y - alignStart.y };
    return {
      ...base,
      anchorPos: { x: pivot.x + refDir.x, y: pivot.y + refDir.y },
      delta: { x: alignDir.x - refDir.x, y: alignDir.y - refDir.y },
      rotateRefLine: { from: refStart, to: refEnd },
      rotateAlignLine: { from: alignStart, to: cursor },
    };
  }
  // `await-ref-start`: the rotation CENTRE has just been picked but no reference
  // line exists yet. Return the base preview (zero delta, `rotatePivot` set) so the
  // pivot ⊙ marker shows the moment the centre is set — the user sees the centre is
  // locked (Giorgio). No ghost is drawn (delta 0 → `applyEntityPreview` no-op), only
  // the pivot marker. `await-base` (centre not yet picked → `!pivot`) returns null above.
  if (step === 'await-ref-start') return base;
  return null;
}

export function buildGripInteractionState(
  hoveredGrip: UnifiedGripInfo | null,
  activeGrip: UnifiedGripInfo | null,
  phase: UnifiedGripPhase,
  armedKeys?: ReadonlySet<string>,
): DxfGripInteractionState {
  const state: DxfGripInteractionState = {};

  // ADR-370 — clicked-to-select grips render orange ('armed'). Independent of the
  // hover/drag phase: an armed grip stays orange while the cursor is elsewhere.
  if (armedKeys && armedKeys.size > 0) {
    state.armedKeys = armedKeys;
  }

  if (hoveredGrip?.source === 'dxf' && (phase === 'hovering' || phase === 'warm')) {
    state.hoveredGrip = {
      entityId: hoveredGrip.entityId!,
      gripIndex: hoveredGrip.gripIndex,
    };
  }
  // `hotGrip` = the click-armed rotate/move flow (the rotation handle was PRESSED
  // but the entity is not being dragged 1:1). Treat it like `dragging` so the
  // pressed grip stays HOT for the whole operation — the user sees the rotation has
  // started (Giorgio). This `activeGrip` reaches the renderer as
  // `BaseEntityRenderer.gripInteraction.active` → `renderGrips` maps it to the
  // PhaseManager `gripState.dragginGrip`, which `GripPhaseRenderer.getGripTemperature`
  // reads for the HOT state (overriding the `hovered` → 'warm').
  if (activeGrip?.source === 'dxf' && (phase === 'dragging' || phase === 'hotGrip')) {
    state.activeGrip = {
      entityId: activeGrip.entityId!,
      gripIndex: activeGrip.gripIndex,
    };
  }
  return state;
}

// ── Overlay Projection Builders ──

export function buildOverlayHoveredVertex(
  hoveredGrip: UnifiedGripInfo | null,
): VertexHoverInfo | null {
  if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'vertex') return null;
  return {
    overlayId: hoveredGrip.overlayId!,
    vertexIndex: hoveredGrip.gripIndex,
  };
}

export function buildOverlayHoveredEdge(
  hoveredGrip: UnifiedGripInfo | null,
  currentOverlays: Overlay[],
): EdgeHoverInfo | null {
  if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'edge') return null;
  const overlay = currentOverlays.find((o) => o.id === hoveredGrip.overlayId);
  const polygonLen = overlay?.polygon?.length ?? 0;
  const edgeIndex = hoveredGrip.gripIndex - polygonLen;
  if (edgeIndex < 0) return null;
  return {
    overlayId: hoveredGrip.overlayId!,
    edgeIndex,
  };
}

export function buildOverlayProjection(
  overlayHoveredVertex: VertexHoverInfo | null,
  overlayHoveredEdge: EdgeHoverInfo | null,
  selectedGrips: SelectedGrip[],
  selectedGrip: SelectedGrip | null,
  draggingVertex: DraggingVertexState | null,
  draggingVertices: DraggingVertexState[] | null,
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null,
  draggingOverlayBody: DraggingOverlayBodyState | null,
  dragPreviewPosition: Point2D | null,
): OverlayProjection {
  return {
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    selectedGrips,
    selectedGrip,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    dragPreviewPosition,
  };
}

export interface GripStateForStack {
  draggingVertex: DraggingVertexState | null;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  hoveredVertexInfo: VertexHoverInfo | null;
  hoveredEdgeInfo: EdgeHoverInfo | null;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  dragPreviewPosition: Point2D | null;
}

export function buildGripStateForStack(
  draggingVertex: DraggingVertexState | null,
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null,
  overlayHoveredVertex: VertexHoverInfo | null,
  overlayHoveredEdge: EdgeHoverInfo | null,
  draggingOverlayBody: DraggingOverlayBodyState | null,
  dragPreviewPosition: Point2D | null,
): GripStateForStack {
  return {
    draggingVertex,
    draggingEdgeMidpoint,
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    draggingOverlayBody,
    dragPreviewPosition,
  };
}
