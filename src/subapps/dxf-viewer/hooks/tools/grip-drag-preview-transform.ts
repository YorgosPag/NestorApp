/**
 * grip-drag-preview-transform — SSoT map: live grip drag-preview → EntityPreviewTransform.
 *
 * Extracted (Boy-Scout, ADR-408 Φ7 P2) from `useGripGhostPreview` so the live ghost
 * AND the home-run wire overlay derive the previewed entity from the SAME snapshot
 * mapping. Both feed the result to `applyEntityPreview`, so the dragged fixture/panel
 * ghost and its circuit wire endpoint can never diverge mid-drag.
 *
 * Pure pass-through (no store / React); optional discriminators are spread only when
 * present so `applyEntityPreview`'s `if (gripKind && type === …)` branches stay exact.
 *
 * @see ./useGripGhostPreview (live ghost — the original home of this mapping)
 * @see ../../components/dxf-layout/HomeRunWiresOverlay (live wire follow — P2 consumer)
 */

import type { DxfGripDragPreview } from '../grip-computation';
import type { EntityPreviewTransform } from '../../rendering/ghost';

/** Map a live grip drag-preview snapshot to the `applyEntityPreview` transform. */
export function toEntityPreviewTransform(dp: DxfGripDragPreview): EntityPreviewTransform {
  return {
    entityId: dp.entityId,
    gripIndex: dp.gripIndex,
    delta: dp.delta,
    movesEntity: dp.movesEntity,
    edgeVertexIndices: dp.edgeVertexIndices,
    // ADR-602 (ADR-587 Φ6) Stage 5 — the ONE tagged grip discriminator SSoT
    // (DxfGripDragPreview→EntityPreviewTransform). The per-entity legacy `xxxGripKind`
    // pass-throughs were deleted; `applyEntityPreview` / `applyParametricBoxPreview` read
    // each discriminator via `gripKindOf`.
    ...(dp.gripKind            ? { gripKind:            dp.gripKind }             : {}),
    ...(dp.anchorPos           ? { anchorPos:           dp.anchorPos }            : {}),
    // ADR-363 Phase 1G — rotation centre for the rotation hot-grip ghost.
    ...(dp.rotatePivot         ? { rotatePivot:         dp.rotatePivot }          : {}),
    // ADR-637 Phase 4-C — target rest-landing id for the live stair-landing ghost.
    ...(dp.landingId           ? { landingId:           dp.landingId }            : {}),
  };
}
