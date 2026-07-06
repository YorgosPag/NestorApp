/**
 * Parametric grip commit handlers for the heating/DHW point hosts (mep-radiator /
 * mep-boiler / mep-water-heater).
 *
 * Extracted from grip-parametric-centred-box-commits.ts (N.7.1 file-size split):
 * all three share the centred-box grip model (centre translate + rotation +
 * opposite-corner-anchored width/length resize) and route through a dedicated
 * UpdateXParamsCommand that re-seeds connectors + recomputes geometry atomically.
 * Merge window (ADR-031) collapses a continuous drag into one undo.
 *
 * ADR-408 Φ-C (connectivity-preserving move): every commit wires
 * `executeHostMoveWithConnectedPipes` so the supply/return (and cold/hot) pipes
 * snapped to the host's connectors FOLLOW the host (XY + Z + rotation) in the same
 * single undo — Revit "host moves, connectors move with it". Re-exported from
 * grip-parametric-commits.ts so the commit API stays one import.
 */
import type { Point2D } from '../../rendering/types/Types';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import { applyMepRadiatorGripDrag } from '../../bim/mep-radiators/mep-radiator-grips';
import { UpdateMepRadiatorParamsCommand } from '../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import { applyMepBoilerGripDrag } from '../../bim/mep-boilers/mep-boiler-grips';
import { UpdateMepBoilerParamsCommand } from '../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import { applyMepWaterHeaterGripDrag } from '../../bim/mep-water-heaters/mep-water-heater-grips';
import { UpdateMepWaterHeaterParamsCommand } from '../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import { executeHostMoveWithConnectedPipes } from '../../bim/mep-segments/build-connectivity-host-update';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-408 Εύρος Β — Parametric heating radiator grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepRadiatorEntity` is params-driven; `UpdateMepRadiatorParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. Φ-C connectivity follow wired.
 */
export function commitMepRadiatorGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepRadiatorGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepRadiatorEntity>;
  if (candidate.type !== 'mep-radiator' || !candidate.params) return;
  const originalParams = candidate.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepRadiatorGripKind === 'mep-radiator-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const newParams = applyMepRadiatorGripDrag(grip.mepRadiatorGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const hostCommand = new UpdateMepRadiatorParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (hostCommand.validate() !== null) return;
  const radiator = candidate as MepRadiatorEntity;
  const entityId = grip.entityId;
  executeHostMoveWithConnectedPipes({
    prevHost: radiator,
    nextHost: { ...radiator, params: newParams },
    hostCommand,
    sceneManager,
    execute: deps.execute,
    emitHost: () => emitBimEntityParamsUpdated('mep-radiator', entityId),
  });
}

/**
 * ADR-408 Εύρος Β #2 — Parametric heating boiler grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepBoilerEntity` is params-driven; `UpdateMepBoilerParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. Φ-C connectivity follow wired.
 */
export function commitMepBoilerGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepBoilerGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepBoilerEntity>;
  if (candidate.type !== 'mep-boiler' || !candidate.params) return;
  const originalParams = candidate.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepBoilerGripKind === 'mep-boiler-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const newParams = applyMepBoilerGripDrag(grip.mepBoilerGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const hostCommand = new UpdateMepBoilerParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (hostCommand.validate() !== null) return;
  const boiler = candidate as MepBoilerEntity;
  const entityId = grip.entityId;
  executeHostMoveWithConnectedPipes({
    prevHost: boiler,
    nextHost: { ...boiler, params: newParams },
    hostCommand,
    sceneManager,
    execute: deps.execute,
    emitHost: () => emitBimEntityParamsUpdated('mep-boiler', entityId),
  });
}

/**
 * ADR-408 DHW — Parametric domestic hot water heater grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepWaterHeaterEntity` is params-driven; `UpdateMepWaterHeaterParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. Φ-C connectivity follow wired.
 */
export function commitMepWaterHeaterGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepWaterHeaterGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepWaterHeaterEntity>;
  if (candidate.type !== 'mep-water-heater' || !candidate.params) return;
  const originalParams = candidate.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepWaterHeaterGripKind === 'mep-water-heater-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = translatePoint(anchor, delta);
  const newParams = applyMepWaterHeaterGripDrag(grip.mepWaterHeaterGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const hostCommand = new UpdateMepWaterHeaterParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (hostCommand.validate() !== null) return;
  const waterHeater = candidate as MepWaterHeaterEntity;
  const entityId = grip.entityId;
  executeHostMoveWithConnectedPipes({
    prevHost: waterHeater,
    nextHost: { ...waterHeater, params: newParams },
    hostCommand,
    sceneManager,
    execute: deps.execute,
    emitHost: () => emitBimEntityParamsUpdated('mep-water-heater', entityId),
  });
}
