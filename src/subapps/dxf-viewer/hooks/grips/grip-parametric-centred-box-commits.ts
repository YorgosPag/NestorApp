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
import type { MepManifoldEntity, MepManifoldParams } from '../../bim/types/mep-manifold-types';
import { buildManifoldParamUpdate } from '../../bim/mep-manifolds/mep-manifold-param-update';
import { clampOutletCount } from '../../bim/mep-manifolds/mep-manifold-geometry';
import type { Entity } from '../../types/entities';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { UpdateMepFixtureParamsCommand } from '../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { UpdateElectricalPanelParamsCommand } from '../../core/commands/entity-commands/UpdateElectricalPanelParamsCommand';
import { applyMepManifoldGripDrag } from '../../bim/mep-manifolds/mep-manifold-grips';
import { UpdateMepManifoldParamsCommand } from '../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import { applyMepRadiatorGripDrag } from '../../bim/mep-radiators/mep-radiator-grips';
import { UpdateMepRadiatorParamsCommand } from '../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import { applyMepBoilerGripDrag } from '../../bim/mep-boilers/mep-boiler-grips';
import { UpdateMepBoilerParamsCommand } from '../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import { applyMepWaterHeaterGripDrag } from '../../bim/mep-water-heaters/mep-water-heater-grips';
import { UpdateMepWaterHeaterParamsCommand } from '../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { UpdateFurnitureParamsCommand } from '../../core/commands/entity-commands/UpdateFurnitureParamsCommand';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { applyFloorplanSymbolGripDrag } from '../../bim/floorplan-symbols/floorplan-symbol-grips';
import { UpdateFloorplanSymbolParamsCommand } from '../../core/commands/entity-commands/UpdateFloorplanSymbolParamsCommand';
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

/**
 * ADR-408 Φ12 — Parametric MEP manifold grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses
 * stretch/move because `MepManifoldEntity` is params-driven;
 * `UpdateMepManifoldParamsCommand` recomputes geometry + validation
 * atomically. Merge window enabled (isDragging=true) so a continuous drag
 * collapses into one undo entry (ADR-031). ORTHO (F8) is read from the
 * non-React `cadToggleState` snapshot and constrains corner drags to the
 * dominant local axis. 1:1 mirror of `commitElectricalPanelGripDrag`.
 */
export function commitMepManifoldGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.mepManifoldGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepManifoldEntity>;
  if (candidate.type !== 'mep-manifold' || !candidate.params) return;
  const originalParams = candidate.params;
  // ADR-408 Φ12 / ADR-397 — the `mep-manifold-rotation` 6-click hot-grip orbits
  // a picked centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore;
  // the delta here is `alignDir − refDir`, so `currentPos = anchor + delta` is the
  // live align point and `pivot` is the rotation centre (mirror
  // `commitElectricalPanelGripDrag`). All other grips use the grip position as anchor.
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.mepManifoldGripKind === 'mep-manifold-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepManifoldGripDrag(grip.mepManifoldGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepManifoldParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:mep-manifold-params-updated', { manifoldId: grip.entityId });
}

/**
 * ADR-408 Φ12 — MEP manifold outlet add/remove ACTION grip commit (Revit "array
 * control" ▲/▼). Unlike the centred-box drag commits this is a single CLICK: it
 * bumps `outletCount` ±1 (clamped [MIN, MAX]) and routes through the shared
 * `buildManifoldParamUpdate` SSoT — the SAME builder the «Έξοδοι» tab uses — so
 * connectors are re-seeded and any pipe snapped to an outlet follows in ONE undo.
 * No drag math / delta: the grip IS the button, so the caller fires this BEFORE
 * the zero-delta guard (mirror `opening-rotation`). A clamp-bound click is a
 * no-op (the grip is also hidden at the bound, this is belt-and-suspenders).
 */
export function commitMepManifoldOutletCountGrip(
  grip: UnifiedGripInfo,
  deps: DxfCommitDeps,
): void {
  if (
    !grip.entityId ||
    (grip.mepManifoldGripKind !== 'mep-manifold-outlet-add' &&
      grip.mepManifoldGripKind !== 'mep-manifold-outlet-remove')
  ) {
    return;
  }
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepManifoldEntity>;
  if (candidate.type !== 'mep-manifold' || !candidate.params) return;
  const manifold = candidate as MepManifoldEntity;
  const originalParams = manifold.params;
  const step = grip.mepManifoldGripKind === 'mep-manifold-outlet-add' ? 1 : -1;
  const nextCount = clampOutletCount(originalParams.outletCount + step);
  if (nextCount === clampOutletCount(originalParams.outletCount)) return; // clamp no-op
  const nextParams: MepManifoldParams = { ...originalParams, outletCount: nextCount };
  // `getEntities` is optional on ISceneManager; absent → no connected-pipe follow
  // (safe fallback: just the manifold command, no compound).
  const entities = (sceneManager.getEntities?.() ?? []) as unknown as readonly Entity[];
  const { command, segmentIds } = buildManifoldParamUpdate(entities, manifold, nextParams, sceneManager);
  deps.execute(command);
  EventBus.emit('bim:mep-manifold-params-updated', { manifoldId: grip.entityId });
  for (const segmentId of segmentIds) {
    EventBus.emit('bim:mep-segment-params-updated', { segmentId });
  }
}

/**
 * ADR-408 Εύρος Β — Parametric heating radiator grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepRadiatorEntity` is params-driven; `UpdateMepRadiatorParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. 1:1 mirror of
 * `commitMepManifoldGripDrag`.
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
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepRadiatorGripDrag(grip.mepRadiatorGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepRadiatorParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:mep-radiator-params-updated', { radiatorId: grip.entityId });
}

/**
 * ADR-408 Εύρος Β #2 — Parametric heating boiler grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepBoilerEntity` is params-driven; `UpdateMepBoilerParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. 1:1 mirror of
 * `commitMepRadiatorGripDrag`.
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
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepBoilerGripDrag(grip.mepBoilerGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepBoilerParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:mep-boiler-params-updated', { boilerId: grip.entityId });
}

/**
 * ADR-408 DHW — Parametric domestic hot water heater grip commit (centre translate +
 * rotation + opposite-corner-anchored width/length resize). Bypasses stretch/move
 * because `MepWaterHeaterEntity` is params-driven; `UpdateMepWaterHeaterParamsCommand`
 * recomputes geometry + validation + re-seeds connectors atomically. Merge window
 * enabled (isDragging=true) collapses a continuous drag into one undo entry
 * (ADR-031). ORTHO (F8) read from `cadToggleState`. 1:1 mirror of
 * `commitMepBoilerGripDrag`.
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
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyMepWaterHeaterGripDrag(grip.mepWaterHeaterGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateMepWaterHeaterParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:mep-water-heater-params-updated', { waterHeaterId: grip.entityId });
}

/**
 * ADR-410 — Parametric furniture grip commit (centre translate + rotation +
 * opposite-corner-anchored width/depth resize). Bypasses stretch/move because
 * `FurnitureEntity` is params-driven; `UpdateFurnitureParamsCommand` recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so a
 * continuous drag collapses into one undo entry (ADR-031). ORTHO (F8) is read
 * from the non-React `cadToggleState` snapshot (same source as the BIM drawing
 * commit path) and constrains corner drags to the dominant local axis. 1:1
 * mirror of `commitMepFixtureGripDrag` (rectangular-only — no diameter).
 */
export function commitFurnitureGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.furnitureGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FurnitureEntity>;
  if (candidate.type !== 'furniture' || !candidate.params) return;
  const originalParams = candidate.params;
  // ADR-410 / ADR-397 — the `furniture-rotation` 6-click hot-grip orbits a picked
  // centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore; the delta
  // here is `alignDir − refDir`, so `currentPos = anchor + delta` is the live align
  // point and `pivot` is the rotation centre (mirror `commitMepFixtureGripDrag`).
  // All other grips use the grip position as anchor (currentPos ignored downstream).
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.furnitureGripKind === 'furniture-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyFurnitureGripDrag(grip.furnitureGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateFurnitureParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:furniture-params-updated', { furnitureId: grip.entityId });
}

/**
 * ADR-415 — Parametric floorplan-symbol grip commit (centre translate + rotation
 * + opposite-corner-anchored width/depth resize). 1:1 mirror of
 * `commitFurnitureGripDrag` (rectangular-only, shares the centred-box SSoT).
 * `UpdateFloorplanSymbolParamsCommand` recomputes geometry + validation
 * atomically; merge window (isDragging=true) collapses a continuous drag into one
 * undo entry. Persistence reacts via the selected-symbol auto-save (2D-only —
 * no EventBus emit needed).
 */
export function commitFloorplanSymbolGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.floorplanSymbolGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FloorplanSymbolEntity>;
  if (candidate.type !== 'floorplan-symbol' || !candidate.params) return;
  const originalParams = candidate.params;
  const rotateCtx = BimRotateHotGripStore.getSnapshot();
  const useRotatePivot =
    grip.floorplanSymbolGripKind === 'floorplan-symbol-rotation' && rotateCtx.pivot !== null && rotateCtx.anchor !== null;
  const anchor: Point2D = useRotatePivot ? rotateCtx.anchor! : grip.position;
  const currentPos: Point2D = { x: anchor.x + delta.x, y: anchor.y + delta.y };
  const newParams = applyFloorplanSymbolGripDrag(grip.floorplanSymbolGripKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...(useRotatePivot ? { pivot: rotateCtx.pivot! } : {}),
  });
  if (newParams === originalParams) return;
  const command = new UpdateFloorplanSymbolParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}
