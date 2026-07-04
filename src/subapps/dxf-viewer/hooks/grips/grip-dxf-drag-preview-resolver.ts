/**
 * ADR-363 / ADR-397 — DXF grip drag-preview resolver.
 *
 * Extracted from useUnifiedGripInteraction (file-size N.7.1). Pure resolver that
 * turns the live grip-session state into the canvas drag-preview ghost:
 *   • wall rotation (6-click reference flow) → guide-line + rotating ghost
 *   • everything else (stretch / move) → standard delta ghost
 *
 * Refs are read by the caller and passed in as plain values, so this stays a
 * single pure function with no React/closure coupling.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { DxfGripDragPreview } from '../grip-computation-types';
import type { UnifiedGripInfo, UnifiedGripPhase } from './unified-grip-types';
import type { WallHotGripOp, HotGripStep } from './wall-hot-grip-fsm';
import { buildDxfDragPreview, buildRotateReferencePreview } from './grip-projections';
import { createSceneManagerAdapter, type DxfCommitDeps } from './grip-commit-adapters';
import { resolveRotateReferenceAnchor } from '../../bim/grips/rotate-reference-axis';
import type { Entity } from '../../types/entities';
import { isActiveGripAltMove } from '../../systems/cursor/GripDragStore';

export interface ResolveDxfDragPreviewParams {
  phase: UnifiedGripPhase;
  activeGrip: UnifiedGripInfo | null;
  anchorPos: Point2D | null;
  currentWorldPos: Point2D | null;
  hotGripOp: WallHotGripOp | null;
  hotGripStep: HotGripStep;
  hotGripBase: Point2D | null;
  hotGripRefStart: Point2D | null;
  hotGripRefEnd: Point2D | null;
  hotGripAlignStart: Point2D | null;
  hotGripRotateBase: Point2D | null;
  typedRotateDeg: number | null;
  dxfCommitDeps: DxfCommitDeps;
}

export function resolveDxfDragPreview(params: ResolveDxfDragPreviewParams): DxfGripDragPreview | null {
  const {
    phase, activeGrip, anchorPos, currentWorldPos,
    hotGripOp, hotGripStep, hotGripBase,
    hotGripRefStart, hotGripRefEnd, hotGripAlignStart, hotGripRotateBase,
    typedRotateDeg, dxfCommitDeps,
  } = params;
  // ADR-363 Phase 1G.3 — wall-rotation uses the 6-click reference flow with its
  // own guide-line + rotating-ghost preview (built from the hot-grip refs).
  if (phase === 'hotGrip' && hotGripOp === 'rotate' && activeGrip?.source === 'dxf') {
    const pivot = hotGripBase;
    // ADR-363 Slice G.7 — DETERMINISTIC reference baseline along the entity's
    // major axis (toward the body), so the live ghost aligns with the pivot→cursor
    // dashed reference line (Giorgio «οι δύο ευθείες να ταυτίζονται»). Recomputed
    // from (pivot, entity) every frame — independent of the timing-sensitive
    // mutable `hotGripRotateBase` (which the Slice G.6 seed could lose). Null
    // entity / no orientation → first-move baseline fallback.
    let freeBaseline = hotGripRotateBase;
    if (pivot && activeGrip.entityId) {
      const entity = createSceneManagerAdapter(dxfCommitDeps)?.getEntity(activeGrip.entityId);
      const axisBaseline = entity ? resolveRotateReferenceAnchor(entity as unknown as Entity, pivot) : null;
      if (axisBaseline) freeBaseline = axisBaseline;
    }
    return buildRotateReferencePreview(
      activeGrip,
      hotGripStep,
      pivot,
      hotGripRefStart,
      hotGripRefEnd,
      hotGripAlignStart,
      currentWorldPos,
      freeBaseline,
      typedRotateDeg,
    );
  }
  // ADR-363 Phase 1G.5 — Alt drag → whole-entity move ghost (base = grabbed grip).
  // The last flag marks a wall "move" hot-grip so ORTHO (F8) locks its ghost too.
  return buildDxfDragPreview(
    phase, activeGrip, anchorPos, currentWorldPos,
    // ADR-560 — blur-proof baked altMove (SSoT resolver) so a React re-render after the
    // Windows Alt→blur cannot flip the ghost back to a parametric edit mid-drag.
    isActiveGripAltMove(),
    phase === 'hotGrip' && hotGripOp === 'move',
  );
}
