/**
 * Parametric foundation-pad grip commit handler.
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size split, 2026-07-10)
 * — behavior-preserving, re-exported from that barrel so the commit API stays a
 * single import. See ADR-436 Slice 1b for the pad grip-commit design.
 */
import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { UpdateFoundationParamsCommand } from '../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { applyFoundationGripDrag } from '../../bim/foundations/foundation-grips';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { EventBus } from '../../systems/events/EventBus';
import type { Entity } from '../../types/entities';
import { buildPadSizingInput, resolvePadSectionLock } from '../../bim/structural/sizing/pad-size-patch';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { createSceneManagerAdapter } from './grip-scene-manager-adapter';

/**
 * ADR-436 Slice 1b — parametric foundation pad grip commit via
 * `UpdateFoundationParamsCommand`. 1:1 mirror of `commitColumnGripDrag`: routes
 * through `applyFoundationGripDrag()` (rotation + width/length resize + Alt-move)
 * — NOT the generic stretch/move — because the pad is params-driven (geometry
 * recomputed atomically). The `foundation-rotation` 6-click hot-grip rotates
 * around a picked centre published in `BimRotateHotGripStore`; all other grips
 * use the grip position as the anchor. Merge window enabled (isDragging=true)
 * collapses a continuous drag into one undo (ADR-031).
 */
export function commitFoundationGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  const foundationKind = gripKindOf(grip, 'foundation');
  if (!grip.entityId || !foundationKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FoundationEntity>;
  if (candidate.type !== 'foundation' || !candidate.params) return;
  const foundation = candidate as FoundationEntity;
  const originalParams = foundation.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    foundationKind === 'foundation-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const newParams = applyFoundationGripDrag(foundationKind, {
    originalParams,
    delta,
    currentPos,
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  // ADR-503 Slice 3 — pad width/length resize = χειροκίνητη διάσταση → safety-gated lock (mirror
  // κολώνας/δοκού· lock-flag = `autoDesigned`, ο reconciler ξαναδιαστασιολογεί μόνο autoDesigned).
  // ≥ επαρκές → lock· < επαρκές → ΜΠΛΟΚ (clamp στην ελάχιστη επαρκή). strip/tie-beam → pass-through.
  let finalParams = newParams;
  let padRejection: { w: number; l: number; minW: number; minL: number } | null = null;
  if (newParams.kind === 'pad' && originalParams.kind === 'pad') {
    // `getEntities` είναι optional στο ISceneManager (interfaces.ts) — ο adapter πάντα το παρέχει,
    // αλλά guard-άρουμε με fallback `[]` (buildPadSizingInput → null σε άδειο → no-op παρακάτω).
    const input = buildPadSizingInput(
      foundation,
      (sceneManager.getEntities?.() ?? []) as unknown as readonly Entity[],
      useStructuralSettingsStore.getState().soilBearingCapacityKpa,
    );
    if (input) {
      const lock = resolvePadSectionLock(input, originalParams, newParams);
      finalParams = lock.params;
      if (lock.rejected) {
        padRejection = { w: newParams.width, l: newParams.length, minW: lock.minWidthMm, minL: lock.minLengthMm };
      }
    }
  }
  const command = new UpdateFoundationParamsCommand(
    grip.entityId,
    finalParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('foundation', grip.entityId);
  if (padRejection) {
    EventBus.emit('bim:foundation-section-rejected', { foundationId: grip.entityId, ...padRejection });
  }
}
