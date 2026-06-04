/**
 * Hot-grip Ctrl-COPY commit handlers (wall / column).
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size; ADR-363 Phase
 * 1G.4 + ADR-397). The MOVE→COPY family is its own concern: instead of
 * translating the existing entity, each handler mints a NEW entity (fresh
 * enterprise ID, recomputed geometry) via the shared per-entity insertion SSoT
 * (`addWallToScene` / `addColumnToScene` — the same routines the draw tools
 * use). `commitHotGripCopy` is the entity-agnostic dispatch consumed by
 * `grip-mouse-handlers`. Re-exported from grip-parametric-commits.ts so the
 * public commit API stays single-import.
 *
 * @see ./grip-parametric-commits.ts
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { buildWallEntity } from '../drawing/wall-completion';
import { addWallToScene } from '../../bim/walls/add-wall-to-scene';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { buildColumnEntity } from '../drawing/column-completion';
import { addColumnToScene } from '../../bim/columns/add-column-to-scene';
import type { BeamEntity } from '../../bim/types/beam-types';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { buildBeamEntity } from '../drawing/beam-completion';
import { addBeamToScene } from '../../bim/beams/add-beam-to-scene';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { applyMepFixtureGripDrag } from '../../bim/mep-fixtures/mep-fixture-grips';
import { buildMepFixtureEntity } from '../drawing/mep-fixture-completion';
import { addMepFixtureToScene } from '../../bim/mep-fixtures/add-mep-fixture-to-scene';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { applyElectricalPanelGripDrag } from '../../bim/electrical-panels/electrical-panel-grips';
import { buildElectricalPanelEntity } from '../drawing/electrical-panel-completion';
import { addElectricalPanelToScene } from '../../bim/electrical-panels/add-electrical-panel-to-scene';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import { applyMepManifoldGripDrag } from '../../bim/mep-manifolds/mep-manifold-grips';
import { buildMepManifoldEntity } from '../drawing/mep-manifold-completion';
import { addMepManifoldToScene } from '../../bim/mep-manifolds/add-mep-manifold-to-scene';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { applyFurnitureGripDrag } from '../../bim/furniture/furniture-grips';
import { buildFurnitureEntity } from '../drawing/furniture-completion';
import { addFurnitureToScene } from '../../bim/furniture/add-furniture-to-scene';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { applyFloorplanSymbolGripDrag } from '../../bim/floorplan-symbols/floorplan-symbol-grips';
import { buildFloorplanSymbolEntity } from '../drawing/floorplan-symbol-completion';
import { addFloorplanSymbolToScene } from '../../bim/floorplan-symbols/add-floorplan-symbol-to-scene';
import { createSceneManagerAdapter } from './grip-commit-adapters';

/**
 * ADR-363 Phase 1G.4 — Ctrl-COPY at the terminal click of a wall MOVE hot-grip
 * (AutoCAD MOVE→COPY). Instead of translating the existing wall, builds a NEW
 * `WallEntity` whose params are the original shifted by `delta` (the same
 * `wall-midpoint` whole-wall translate the MOVE uses) and inserts it via the
 * shared `addWallToScene` SSoT — fresh enterprise ID (N.6, via `buildWallEntity`
 * → `createWall`), trims recomputed, `drawing:entity-created` broadcast so
 * persistence saves the copy. The original is left untouched. Single copy: the
 * hot-grip resets after this call (no continuous copy chain).
 */
export function commitWallCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.wallGripKind !== 'wall-midpoint') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<WallEntity>;
  if (candidate.type !== 'wall' || !candidate.params) return;
  const wall = candidate as WallEntity;
  const originalParams = wall.params;
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const translated = applyWallGripDrag('wall-midpoint', { originalParams, delta, currentPos });
  const sceneUnits = originalParams.sceneUnits ?? 'mm';
  const built = buildWallEntity(translated, wall.layerId, wall.kind ?? 'straight', sceneUnits);
  if (!built.ok) return;
  addWallToScene(built.entity, deps);
}

/**
 * ADR-397 — Ctrl-COPY at the terminal click of a column MOVE hot-grip
 * (AutoCAD MOVE→COPY). Mirror of `commitWallCopy`: builds a NEW `ColumnEntity`
 * whose params are the original shifted by `delta` (the same `column-center`
 * whole-column translate the MOVE uses) and inserts it via the shared
 * `addColumnToScene` SSoT — fresh enterprise ID (N.6, via `buildColumnEntity`
 * → `createColumn`), `drawing:entity-created` broadcast so persistence saves the
 * copy. The original is left untouched. Single copy: the hot-grip resets after.
 */
export function commitColumnCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.columnGripKind !== 'column-center') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<ColumnEntity>;
  if (candidate.type !== 'column' || !candidate.params) return;
  const column = candidate as ColumnEntity;
  const originalParams = column.params;
  const translated = applyColumnGripDrag('column-center', { originalParams, delta });
  const sceneUnits = originalParams.sceneUnits ?? 'mm';
  const built = buildColumnEntity(translated, column.layerId, sceneUnits);
  if (!built.ok) return;
  addColumnToScene(built.entity, deps);
}

/**
 * ADR-363 Phase 5.5d — Ctrl-COPY at the terminal click of a beam MOVE hot-grip
 * (AutoCAD MOVE→COPY). Mirror of `commitWallCopy`/`commitColumnCopy`: builds a NEW
 * `BeamEntity` whose params are the original shifted by `delta` (the same
 * `beam-midpoint` whole-beam translate the MOVE uses — moves startPoint + endPoint
 * + curveControl) and inserts it via the shared `addBeamToScene` SSoT — fresh
 * enterprise ID (N.6, via `buildBeamEntity` → `createBeam`), `drawing:entity-created`
 * broadcast so persistence saves the copy. Original untouched; single copy.
 */
export function commitBeamCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.beamGripKind !== 'beam-midpoint') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<BeamEntity>;
  if (candidate.type !== 'beam' || !candidate.params) return;
  const beam = candidate as BeamEntity;
  const originalParams = beam.params;
  const translated = applyBeamGripDrag('beam-midpoint', { originalParams, delta });
  const sceneUnits = originalParams.sceneUnits ?? 'mm';
  const built = buildBeamEntity(translated, beam.layerId, sceneUnits);
  if (!built.ok) return;
  addBeamToScene(built.entity, deps);
}

/**
 * ADR-406 — Ctrl-COPY at the terminal click of a MEP fixture MOVE hot-grip
 * (AutoCAD MOVE→COPY). Mirror of `commitWallCopy`/`commitColumnCopy`: builds a
 * NEW `MepFixtureEntity` whose params are the original shifted by `delta` (the
 * same `mep-fixture-move` whole-fixture translate the MOVE uses) and inserts it
 * via the shared `addMepFixtureToScene` SSoT — fresh enterprise ID (N.6, via
 * `buildMepFixtureEntity` → `createMepFixture`), `drawing:entity-created`
 * broadcast so persistence saves the copy. Original untouched; single copy.
 */
export function commitMepFixtureCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.mepFixtureGripKind !== 'mep-fixture-move') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepFixtureEntity>;
  if (candidate.type !== 'mep-fixture' || !candidate.params) return;
  const fixture = candidate as MepFixtureEntity;
  const translated = applyMepFixtureGripDrag('mep-fixture-move', { originalParams: fixture.params, delta });
  const built = buildMepFixtureEntity(translated, fixture.layerId);
  if (!built.ok) return;
  addMepFixtureToScene(built.entity, deps);
}

/**
 * ADR-408 Φ3 — Ctrl-COPY at the terminal click of an electrical panel MOVE
 * hot-grip (AutoCAD MOVE→COPY). Mirror of `commitMepFixtureCopy`: builds a NEW
 * `ElectricalPanelEntity` whose params are the original shifted by `delta` (the
 * same `electrical-panel-move` whole-panel translate the MOVE uses) and inserts
 * it via the shared `addElectricalPanelToScene` SSoT — fresh enterprise ID (N.6,
 * via `buildElectricalPanelEntity` → `createElectricalPanel`),
 * `drawing:entity-created` broadcast so persistence saves the copy. Original
 * untouched; single copy.
 */
export function commitElectricalPanelCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.electricalPanelGripKind !== 'electrical-panel-move') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<ElectricalPanelEntity>;
  if (candidate.type !== 'electrical-panel' || !candidate.params) return;
  const panel = candidate as ElectricalPanelEntity;
  const translated = applyElectricalPanelGripDrag('electrical-panel-move', { originalParams: panel.params, delta });
  const built = buildElectricalPanelEntity(translated, panel.layerId);
  if (!built.ok) return;
  addElectricalPanelToScene(built.entity, deps);
}

/**
 * ADR-408 Φ12 — Ctrl-COPY at the terminal click of a MEP manifold MOVE
 * hot-grip (AutoCAD MOVE→COPY). Mirror of `commitElectricalPanelCopy`: builds a NEW
 * `MepManifoldEntity` whose params are the original shifted by `delta` (the
 * same `mep-manifold-move` whole-manifold translate the MOVE uses) and inserts
 * it via the shared `addMepManifoldToScene` SSoT — fresh enterprise ID (N.6,
 * via `buildMepManifoldEntity` → `createMepManifold`),
 * `drawing:entity-created` broadcast so persistence saves the copy. Original
 * untouched; single copy.
 */
export function commitMepManifoldCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.mepManifoldGripKind !== 'mep-manifold-move') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<MepManifoldEntity>;
  if (candidate.type !== 'mep-manifold' || !candidate.params) return;
  const manifold = candidate as MepManifoldEntity;
  const translated = applyMepManifoldGripDrag('mep-manifold-move', { originalParams: manifold.params, delta });
  const built = buildMepManifoldEntity(translated, manifold.layerId);
  if (!built.ok) return;
  addMepManifoldToScene(built.entity, deps);
}

/**
 * ADR-410 — Ctrl-COPY at the terminal click of a furniture MOVE hot-grip
 * (AutoCAD MOVE→COPY). Mirror of `commitMepFixtureCopy`: builds a NEW
 * `FurnitureEntity` whose params are the original shifted by `delta` (the same
 * `furniture-move` whole-entity translate the MOVE uses) and inserts it via the
 * shared `addFurnitureToScene` SSoT — fresh enterprise ID (N.6, via
 * `buildFurnitureEntity` → `createFurniture`), `drawing:entity-created`
 * broadcast so persistence saves the copy. Original untouched; single copy.
 */
export function commitFurnitureCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.furnitureGripKind !== 'furniture-move') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FurnitureEntity>;
  if (candidate.type !== 'furniture' || !candidate.params) return;
  const furniture = candidate as FurnitureEntity;
  const translated = applyFurnitureGripDrag('furniture-move', { originalParams: furniture.params, delta });
  const built = buildFurnitureEntity(translated, furniture.layerId);
  if (!built.ok) return;
  addFurnitureToScene(built.entity, deps);
}

/**
 * ADR-415 — Ctrl-COPY at the terminal click of a floorplan-symbol MOVE hot-grip
 * (AutoCAD MOVE→COPY). 1:1 mirror of `commitFurnitureCopy`: builds a NEW
 * `FloorplanSymbolEntity` whose params are the original shifted by `delta` (the
 * same `floorplan-symbol-move` whole-entity translate) and inserts it via the
 * shared `addFloorplanSymbolToScene` SSoT — fresh enterprise ID (N.6),
 * `drawing:entity-created` broadcast so persistence saves the copy. Original
 * untouched; single copy.
 */
export function commitFloorplanSymbolCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || grip.floorplanSymbolGripKind !== 'floorplan-symbol-move') return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FloorplanSymbolEntity>;
  if (candidate.type !== 'floorplan-symbol' || !candidate.params) return;
  const symbol = candidate as FloorplanSymbolEntity;
  const translated = applyFloorplanSymbolGripDrag('floorplan-symbol-move', { originalParams: symbol.params, delta });
  const built = buildFloorplanSymbolEntity(translated, symbol.layerId);
  if (!built.ok) return;
  addFloorplanSymbolToScene(built.entity, deps);
}

/**
 * ADR-397 — entity-agnostic Ctrl-COPY dispatch for the MOVE hot-grip terminal
 * click. Routes to the per-entity copy SSoT by the grip's kind. Returns `true`
 * when a copy was made (caller skips the translate), `false` when the kind has
 * no copy path (caller falls through to the normal move commit). Keeps
 * `grip-mouse-handlers` free of per-entity branching.
 */
export function commitHotGripCopy(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): boolean {
  if (grip.wallGripKind === 'wall-midpoint') {
    commitWallCopy(grip, delta, deps);
    return true;
  }
  if (grip.columnGripKind === 'column-center') {
    commitColumnCopy(grip, delta, deps);
    return true;
  }
  if (grip.beamGripKind === 'beam-midpoint') {
    commitBeamCopy(grip, delta, deps);
    return true;
  }
  if (grip.mepFixtureGripKind === 'mep-fixture-move') {
    commitMepFixtureCopy(grip, delta, deps);
    return true;
  }
  if (grip.electricalPanelGripKind === 'electrical-panel-move') {
    commitElectricalPanelCopy(grip, delta, deps);
    return true;
  }
  if (grip.mepManifoldGripKind === 'mep-manifold-move') {
    commitMepManifoldCopy(grip, delta, deps);
    return true;
  }
  if (grip.furnitureGripKind === 'furniture-move') {
    commitFurnitureCopy(grip, delta, deps);
    return true;
  }
  if (grip.floorplanSymbolGripKind === 'floorplan-symbol-move') {
    commitFloorplanSymbolCopy(grip, delta, deps);
    return true;
  }
  return false;
}
