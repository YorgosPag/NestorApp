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
import { executeHostMoveWithConnectedPipes } from '../../bim/mep-segments/build-connectivity-host-update';
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { UpdateFurnitureParamsCommand } from '../../core/commands/entity-commands/UpdateFurnitureParamsCommand';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { applyFloorplanSymbolGripDrag } from '../../bim/floorplan-symbols/floorplan-symbol-grips';
import { UpdateFloorplanSymbolParamsCommand } from '../../core/commands/entity-commands/UpdateFloorplanSymbolParamsCommand';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { resolveParametricGripEntity, resolveGripCommitAnchor } from './grip-commit-resolve';
import { gripKindOf } from '../grip-kinds';

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
  const mepFixtureKind = gripKindOf(grip, 'mep-fixture');
  if (!grip.entityId || !mepFixtureKind) return;
  const resolved = resolveParametricGripEntity<MepFixtureEntity>(deps, grip.entityId, 'mep-fixture');
  if (!resolved) return;
  const { sceneManager, entity: fixture } = resolved;
  const originalParams = fixture.params;
  // ADR-406 / ADR-397 — the `mep-fixture-rotation` 6-click hot-grip orbits a picked
  // centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore; the delta
  // here is `alignDir − refDir`, so `currentPos = anchor + delta` is the live align
  // point and `pivot` is the rotation centre (mirror `commitWallGripDrag`). All
  // other grips use the grip position as anchor (currentPos ignored downstream).
  const { currentPos, pivotPatch } = resolveGripCommitAnchor(
    mepFixtureKind === 'mep-fixture-rotation',
    grip.position,
    delta,
  );
  const newParams = applyMepFixtureGripDrag(mepFixtureKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...pivotPatch,
  });
  if (newParams === originalParams) return;
  const hostCommand = new UpdateMepFixtureParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (hostCommand.validate() !== null) return;
  // ADR-408 Φ-C — connectivity-preserving move: pipe ends snapped to this fixture's
  // supply/drain connectors follow it (XY + Z + rotation) in one undo (Revit-style).
  const entityId = grip.entityId;
  executeHostMoveWithConnectedPipes({
    prevHost: fixture,
    nextHost: { ...fixture, params: newParams },
    hostCommand,
    sceneManager,
    execute: deps.execute,
    emitHost: () => emitBimEntityParamsUpdated('mep-fixture', entityId),
  });
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
  const electricalPanelKind = gripKindOf(grip, 'electrical-panel');
  if (!grip.entityId || !electricalPanelKind) return;
  const resolved = resolveParametricGripEntity<ElectricalPanelEntity>(deps, grip.entityId, 'electrical-panel');
  if (!resolved) return;
  const { sceneManager, entity: panel } = resolved;
  const originalParams = panel.params;
  // ADR-408 / ADR-397 — the `electrical-panel-rotation` 6-click hot-grip orbits a
  // picked centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore;
  // the delta here is `alignDir − refDir`, so `currentPos = anchor + delta` is the
  // live align point and `pivot` is the rotation centre (mirror
  // `commitMepFixtureGripDrag`). All other grips use the grip position as anchor.
  const { currentPos, pivotPatch } = resolveGripCommitAnchor(
    electricalPanelKind === 'electrical-panel-rotation',
    grip.position,
    delta,
  );
  const newParams = applyElectricalPanelGripDrag(electricalPanelKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...pivotPatch,
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
  emitBimEntityParamsUpdated('electrical-panel', grip.entityId);
}

/**
 * Resolves the scene-manager adapter + the hovered `MepManifoldEntity` (typed, with
 * its `params`) for a grip commit, or `null` when the entity is missing/mistyped.
 * Shared by the drag-commit and the outlet-count-click-commit below.
 */
function resolveMepManifoldGripContext(deps: DxfCommitDeps, entityId: string) {
  const resolved = resolveParametricGripEntity<MepManifoldEntity>(deps, entityId, 'mep-manifold');
  if (!resolved) return null;
  return {
    sceneManager: resolved.sceneManager,
    manifold: resolved.entity,
    originalParams: resolved.entity.params,
  };
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
  const mepManifoldKind = gripKindOf(grip, 'mep-manifold');
  if (!grip.entityId || !mepManifoldKind) return;
  const ctx = resolveMepManifoldGripContext(deps, grip.entityId);
  if (!ctx) return;
  const { sceneManager, originalParams } = ctx;
  // ADR-408 Φ12 / ADR-397 — the `mep-manifold-rotation` 6-click hot-grip orbits
  // a picked centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore;
  // the delta here is `alignDir − refDir`, so `currentPos = anchor + delta` is the
  // live align point and `pivot` is the rotation centre (mirror
  // `commitElectricalPanelGripDrag`). All other grips use the grip position as anchor.
  const { currentPos, pivotPatch } = resolveGripCommitAnchor(
    mepManifoldKind === 'mep-manifold-rotation',
    grip.position,
    delta,
  );
  const newParams = applyMepManifoldGripDrag(mepManifoldKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...pivotPatch,
  });
  if (newParams === originalParams) return;
  const hostCommand = new UpdateMepManifoldParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (hostCommand.validate() !== null) return;
  // ADR-408 Φ-C — connectivity-preserving move: pipes snapped to the manifold's
  // inlet/outlets follow it (XY + Z + rotation) in one undo (Revit-style). The
  // outlet add/remove grip keeps its own Z-only `buildManifoldParamUpdate` path.
  const manifold = ctx.manifold;
  const entityId = grip.entityId;
  executeHostMoveWithConnectedPipes({
    prevHost: manifold,
    nextHost: { ...manifold, params: newParams },
    hostCommand,
    sceneManager,
    execute: deps.execute,
    emitHost: () => emitBimEntityParamsUpdated('mep-manifold', entityId),
  });
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
  const outletGripKind = gripKindOf(grip, 'mep-manifold');
  if (
    !grip.entityId ||
    (outletGripKind !== 'mep-manifold-outlet-add' &&
      outletGripKind !== 'mep-manifold-outlet-remove')
  ) {
    return;
  }
  const ctx = resolveMepManifoldGripContext(deps, grip.entityId);
  if (!ctx) return;
  const { sceneManager, manifold, originalParams } = ctx;
  const step = outletGripKind === 'mep-manifold-outlet-add' ? 1 : -1;
  const nextCount = clampOutletCount(originalParams.outletCount + step);
  if (nextCount === clampOutletCount(originalParams.outletCount)) return; // clamp no-op
  const nextParams: MepManifoldParams = { ...originalParams, outletCount: nextCount };
  // `getEntities` is optional on ISceneManager; absent → no connected-pipe follow
  // (safe fallback: just the manifold command, no compound).
  const entities = (sceneManager.getEntities?.() ?? []) as unknown as readonly Entity[];
  const { command, segmentIds } = buildManifoldParamUpdate(entities, manifold, nextParams, sceneManager);
  deps.execute(command);
  emitBimEntityParamsUpdated('mep-manifold', grip.entityId);
  for (const segmentId of segmentIds) {
    emitBimEntityParamsUpdated('mep-segment', segmentId);
  }
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
  const furnitureKind = gripKindOf(grip, 'furniture');
  if (!grip.entityId || !furnitureKind) return;
  const resolved = resolveParametricGripEntity<FurnitureEntity>(deps, grip.entityId, 'furniture');
  if (!resolved) return;
  const { sceneManager, entity: furniture } = resolved;
  const originalParams = furniture.params;
  // ADR-410 / ADR-397 — the `furniture-rotation` 6-click hot-grip orbits a picked
  // centre. The hook publishes {pivot, anchor} in BimRotateHotGripStore; the delta
  // here is `alignDir − refDir`, so `currentPos = anchor + delta` is the live align
  // point and `pivot` is the rotation centre (mirror `commitMepFixtureGripDrag`).
  // All other grips use the grip position as anchor (currentPos ignored downstream).
  const { currentPos, pivotPatch } = resolveGripCommitAnchor(
    furnitureKind === 'furniture-rotation',
    grip.position,
    delta,
  );
  const newParams = applyFurnitureGripDrag(furnitureKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...pivotPatch,
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
  emitBimEntityParamsUpdated('furniture', grip.entityId);
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
  const floorplanSymbolKind = gripKindOf(grip, 'floorplan-symbol');
  if (!grip.entityId || !floorplanSymbolKind) return;
  const resolved = resolveParametricGripEntity<FloorplanSymbolEntity>(deps, grip.entityId, 'floorplan-symbol');
  if (!resolved) return;
  const { sceneManager, entity: symbol } = resolved;
  const originalParams = symbol.params;
  const { currentPos, pivotPatch } = resolveGripCommitAnchor(
    floorplanSymbolKind === 'floorplan-symbol-rotation',
    grip.position,
    delta,
  );
  const newParams = applyFloorplanSymbolGripDrag(floorplanSymbolKind, {
    originalParams,
    delta,
    currentPos,
    ortho: cadToggleState.isOrthoOn(),
    ...pivotPatch,
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
