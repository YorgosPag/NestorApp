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
    // ADR-358 Phase 5d — stair parametric ghost discriminator pass-through.
    ...(dp.stairGripKind       ? { stairGripKind:       dp.stairGripKind }       : {}),
    // ADR-363 Phase 1C — wall parametric ghost discriminator pass-through.
    ...(dp.wallGripKind        ? { wallGripKind:        dp.wallGripKind }         : {}),
    // ADR-363 Phase 5.5 / 3.5 / 3.7a — beam / slab / slab-opening parametric ghost.
    ...(dp.beamGripKind        ? { beamGripKind:        dp.beamGripKind }         : {}),
    // ADR-397 — column parametric ghost (move/rotation/resize) pass-through.
    ...(dp.columnGripKind      ? { columnGripKind:      dp.columnGripKind }       : {}),
    ...(dp.slabGripKind        ? { slabGripKind:        dp.slabGripKind }         : {}),
    ...(dp.slabOpeningGripKind ? { slabOpeningGripKind: dp.slabOpeningGripKind }  : {}),
    // ADR-406 — MEP fixture parametric ghost (move / rotation / corner resize).
    ...(dp.mepFixtureGripKind  ? { mepFixtureGripKind:  dp.mepFixtureGripKind }   : {}),
    // ADR-408 Φ3 — electrical panel parametric ghost (move / rotation / corner resize).
    ...(dp.electricalPanelGripKind ? { electricalPanelGripKind: dp.electricalPanelGripKind } : {}),
    ...(dp.anchorPos           ? { anchorPos:           dp.anchorPos }            : {}),
    // ADR-363 Phase 1G — rotation centre for the rotation hot-grip ghost.
    ...(dp.rotatePivot         ? { rotatePivot:         dp.rotatePivot }          : {}),
  };
}
