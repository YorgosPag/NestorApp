/**
 * Parametric grip commit handlers for centred-box MEP entities (MEP fixture /
 * electrical panel).
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size split). Both
 * entities share the centred-box grip model (centre translate + rotation +
 * opposite-corner-anchored width/length resize) and route through a dedicated
 * UpdateXParamsCommand so geometry + validation recompute atomically. Merge
 * window (ADR-031) is enabled so a continuous drag collapses into a single undo
 * entry. Re-exported from grip-parametric-commits.ts so the commit API stays one
 * import.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { UpdateMepFixtureParamsCommand } from '../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { UpdateElectricalPanelParamsCommand } from '../../core/commands/entity-commands/UpdateElectricalPanelParamsCommand';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { EventBus } from '../../systems/events/EventBus';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-406 — Parametric MEP fixture grip commit (centre translate + rotation +
 * opposite-corner-anchored width/length resize). Bypasses stretch/move because
 * `MepFixtureEntity` is params-driven; `UpdateMepFixtureParamsCommand` recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so a
 * continuous drag collapses into one undo entry (ADR-031). ORTHO (F8) is read
 * from the non-React `cadToggleState` snapshot (same source as the BIM drawing
 * commit path) and constrains corner drags to the dominant local axis.
 */
export function commitMepFixtureGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepFixtureGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepFixtureEntity>;
  if (candidate.type !== 'mep-fixture' || !candidate.params) return;
  const originalParams = candidate.params;
  // ADR-406 / ADR-397 — the `mep-fixture-rotation` 6-click hot-grip orbits a picked
  // centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore; the delta
  // here is `alignDir − refDir`, so `currentPos = anchor + delta` is the live align
  // point and `pivot` is the rotation centre (mirror `commitWallGripDrag`). All
  // other grips use the grip position as anchor (currentPos ignored downstream).
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepFixtureGripKind === 'mep-fixture-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepFixtureGripDrag(grip.mepFixtureGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepFixtureParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:mep-fixture-params-updated', { fixtureId: grip.entityId });
}

/**
 * ADR-408 Φ3 — Parametric electrical panel grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `ElectricalPanelEntity` is params-driven;
 * `UpdateElectricalPanelParamsCommand` recomputes geometry + validation
 * atomically. Merge window enabled (isDragging=true) so a continuous drag
 * collapses into one undo entry (ADR-031). ORTHO (F8) is read from the non-React
 * `cadToggleState` snapshot (same source as the BIM drawing commit path) and
 * constrains corner drags to the dominant local axis. 1:1 mirror of
 * `commitMepFixtureGripDrag`.
 */
export function commitElectricalPanelGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.electricalPanelGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<ElectricalPanelEntity>;
  if (candidate.type !== 'electrical-panel' || !candidate.params) return;
  const originalParams = candidate.params;
  // ADR-408 / ADR-397 — the `electrical-panel-rotation` 6-click hot-grip orbits a
  // picked centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore;
  // the delta here is `alignDir − refDir`, so `currentPos = anchor + delta` is the
  // live align point and `pivot` is the rotation centre (mirror
  // `commitMepFixtureGripDrag`). All other grips use the grip position as anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.electricalPanelGripKind === 'electrical-panel-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyElectricalPanelGripDrag(grip.electricalPanelGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateElectricalPanelParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:electrical-panel-params-updated', { panelId: grip.entityId });
}
