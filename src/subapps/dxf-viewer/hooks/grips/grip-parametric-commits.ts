/**
 * Parametric grip commit handlers (stair / wall / opening / slab / dimension).
 *
 * Extracted from grip-commit-adapters.ts (ADR-358 Phase 5b, ADR-363 Phase 1C /
 * 2.5 / 3.5, ADR-362 Phase I2). Each handler bypasses the generic stretch /
 * move path because the underlying entity is parametric: geometry is derived
 * from `params`, so the commit recomputes geometry atomically via a dedicated
 * UpdateXParamsCommand. Merge window (ADR-031) is enabled for wall / opening /
 * slab so a continuous drag collapses into a single undo entry.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { DxfCommitDeps } from './unified-grip-types';
import type { StairEntity } from '../../types/stair';
import type { WallEntity, WallKind } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { XLineEntity, RayEntity } from '../../types/entities';
import type { DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateSlabOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';
import { UpdateBeamParamsCommand } from '../../core/commands/entity-commands/UpdateBeamParamsCommand';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { applyStairGripDrag } from '../../systems/stairs/stair-grips';
import { applyWallGripDrag } from '../../bim/walls/wall-grips';
import { applyOpeningGripDrag } from '../../bim/walls/opening-grips';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { applyBeamGripDrag } from '../../bim/beams/beam-grips';
import { applyColumnGripDrag } from '../../bim/columns/column-grips';
import { applyXLineGripDrag } from '../../systems/xline/xline-grips';
import { applyRayGripDrag } from '../../systems/ray/ray-grips';
import { applyDimensionGripDrag } from '../dimensions/useDimensionGrips';
import { EventBus } from '../../systems/events/EventBus';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { createSceneManagerAdapter } from './grip-commit-adapters';
import { coordinateWallUpdate } from '../../bim/walls/wall-opening-coordinator';

/**
 * ADR-358 Phase 5b — Parametric stair grip commit. Bypasses the standard
 * stretch / move / rotate strategies because `StairEntity` is parametric:
 * geometry is fully derived from `params`, so the grip drag transforms params
 * (via `applyStairGripDrag`) and the command (`UpdateStairParamsCommand`)
 * recomputes geometry atomically. Idempotent + undo/redo-safe.
 */
export function commitStairGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.stairGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<StairEntity>;
  if (candidate.type !== 'stair' || !candidate.params) return;
  const stair = candidate as StairEntity;
  const originalParams = stair.params;
  const currentPos: Point2D = {
    x: grip.position.x + delta.x,
    y: grip.position.y + delta.y,
  };
  const newParams = applyStairGripDrag(grip.stairGripKind, {
    originalParams,
    delta,
    currentPos,
  });
  const command = new UpdateStairParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    false,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}

/**
 * ADR-363 Phase 1C — Parametric wall grip commit. Bypasses the standard
 * stretch / move strategies because `WallEntity` is parametric: geometry is
 * fully derived from `params`, so the grip drag transforms params (via
 * `applyWallGripDrag`) and the command (`UpdateWallParamsCommand`) recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so
 * a continuous drag collapses into a single undo entry (ADR-031).
 */
export function commitWallGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.wallGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<WallEntity>;
  if (candidate.type !== 'wall' || !candidate.params) return;
  const wall = candidate as WallEntity;
  const originalParams = wall.params;
  const currentPos: Point2D = {
    x: grip.position.x + delta.x,
    y: grip.position.y + delta.y,
  };
  const newParams = applyWallGripDrag(grip.wallGripKind, {
    originalParams,
    delta,
    currentPos,
  });
  const kind: WallKind = wall.kind ?? 'straight';
  const wallCmd = new UpdateWallParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
    kind,
  );
  if (wallCmd.validate() !== null) return;
  const command = coordinateWallUpdate(
    wallCmd, grip.entityId, originalParams, newParams, sceneManager, true,
  );
  deps.execute(command);
  EventBus.emit('bim:wall-params-updated', { wallId: grip.entityId });
}

/**
 * ADR-363 Phase 2.5 — Parametric opening grip commit (drag-along-wall).
 * Mirrors `commitWallGripDrag` semantics: routes through `applyOpeningGripDrag()`
 * + `UpdateOpeningParamsCommand` so geometry + validation recompute atomically
 * and the merge window (ADR-031) collapses a continuous drag into one undo
 * entry. Host wall is resolved via `params.wallId`; commit is a no-op when the
 * host is missing (soft-orphan policy, ADR-363 §5.4).
 */
export function commitOpeningGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.openingGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<OpeningEntity>;
  if (candidate.type !== 'opening' || !candidate.params) return;
  const opening = candidate as OpeningEntity;
  const hostRaw = sceneManager.getEntity(opening.params.wallId);
  if (!hostRaw) return;
  const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
  if (hostCandidate.type !== 'wall' || !hostCandidate.params || !hostCandidate.geometry) return;
  const hostWall = hostCandidate as WallEntity;
  const originalParams = opening.params;
  const currentPos: Point2D = {
    x: grip.position.x + delta.x,
    y: grip.position.y + delta.y,
  };
  const newParams = applyOpeningGripDrag(grip.openingGripKind, {
    originalParams,
    currentPos,
    hostWall,
  });
  if (newParams === originalParams) return;
  const command = new UpdateOpeningParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:opening-params-updated', { openingId: grip.entityId });
}

/**
 * ADR-363 Phase 3.5 — Parametric slab grip commit (per-vertex translate).
 * Mirrors `commitWallGripDrag` / `commitOpeningGripDrag` semantics: routes
 * through `applySlabGripDrag()` + `UpdateSlabParamsCommand` so geometry +
 * validation recompute atomically and the merge window (ADR-031) collapses a
 * continuous drag into one undo entry. Emits `bim:slab-params-updated` after
 * dispatch so consumers (auto-save / BOQ feed) can react.
 */
export function commitSlabGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.slabGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<SlabEntity>;
  if (candidate.type !== 'slab' || !candidate.params) return;
  const slab = candidate as SlabEntity;
  const originalParams = slab.params;
  // ADR-363 Phase 3.6 — Shift quantizes the drag to the dominant world axis
  // (rectilinear constraint). Read from the keyboard tracker so the modifier
  // can travel from `keydown` → commit without plumbing through 4 handler
  // layers (mouse-handler-up loses the native event by design).
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applySlabGripDrag(grip.slabGripKind, {
    originalParams,
    delta,
    rectilinear,
  });
  if (newParams === originalParams) return;
  const command = new UpdateSlabParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:slab-params-updated', { slabId: grip.entityId });
}

/**
 * ADR-363 Phase 3.7a — Parametric slab-opening grip commit (per-vertex
 * translate + edge-midpoint vertex insertion). Mirrors `commitSlabGripDrag`
 * semantics: routes through `applySlabOpeningGripDrag()` +
 * `UpdateSlabOpeningParamsCommand` so geometry + validation recompute
 * atomically και merge window (ADR-031) collapses συνεχόμενο drag σε ένα undo
 * entry. Emits `bim:slab-opening-params-updated` after dispatch ώστε consumers
 * (auto-save / BOQ feed) να αντιδρούν. Shift διαβάζεται από τον
 * `ShiftKeyTracker` (rectilinear constraint, mirror Phase 3.6).
 */
export function commitSlabOpeningGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.slabOpeningGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<SlabOpeningEntity>;
  if (candidate.type !== 'slab-opening' || !candidate.params) return;
  const opening = candidate as SlabOpeningEntity;
  const originalParams = opening.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applySlabOpeningGripDrag(grip.slabOpeningGripKind, {
    originalParams,
    delta,
    rectilinear,
  });
  if (newParams === originalParams) return;
  const command = new UpdateSlabOpeningParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:slab-opening-params-updated', { slabOpeningId: grip.entityId });
}

/**
 * ADR-363 Phase 5.5a — Parametric beam grip commit. Bypasses the standard
 * stretch / move strategies because `BeamEntity` is parametric: geometry is
 * fully derived from `params`, so the grip drag transforms params (via
 * `applyBeamGripDrag`) and the command (`UpdateBeamParamsCommand`) recomputes
 * geometry + validation atomically. Merge window enabled (isDragging=true) so
 * a continuous drag collapses σε ένα undo entry (ADR-031). Emits
 * `bim:beam-params-updated` after dispatch ώστε consumers (auto-save / BOQ
 * feed) να αντιδρούν.
 */
export function commitBeamGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.beamGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<BeamEntity>;
  if (candidate.type !== 'beam' || !candidate.params) return;
  const beam = candidate as BeamEntity;
  const originalParams = beam.params;
  const newParams = applyBeamGripDrag(grip.beamGripKind, {
    originalParams,
    delta,
  });
  if (newParams === originalParams) return;
  const command = new UpdateBeamParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:beam-params-updated', { beamId: grip.entityId });
}

/**
 * ADR-363 Phase 4.5 — Parametric column grip commit. Bypasses the standard
 * stretch / move strategies because `ColumnEntity` is parametric: geometry is
 * fully derived from `params`, so the grip drag transforms params (via
 * `applyColumnGripDrag`) και το command (`UpdateColumnParamsCommand`)
 * recomputes geometry + validation atomically. Merge window enabled
 * (isDragging=true) so a continuous drag collapses σε ένα undo entry
 * (ADR-031). Emits `bim:column-params-updated` after dispatch ώστε consumers
 * (auto-save / BOQ feed) να αντιδρούν.
 */
export function commitColumnGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.columnGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<ColumnEntity>;
  if (candidate.type !== 'column' || !candidate.params) return;
  const column = candidate as ColumnEntity;
  const originalParams = column.params;
  const newParams = applyColumnGripDrag(grip.columnGripKind, {
    originalParams,
    delta,
  });
  if (newParams === originalParams) return;
  const command = new UpdateColumnParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  EventBus.emit('bim:column-params-updated', { columnId: grip.entityId });
}

/**
 * ADR-359 Phase 11 — XLine grip commit via `applyXLineGripDrag` + direct scene
 * patch. Bypasses stretch/move because XLine has no vertex array: only
 * `basePoint` (translate) and `direction` (rotate) fields. Follows the
 * dimension-grip pattern (scene patch without a dedicated command).
 */
export function commitXLineGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.xlineGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'xline') return;
  const entity = raw as unknown as XLineEntity;
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const updates = applyXLineGripDrag(grip.xlineGripKind, { entity, delta, currentPos });
  if (Object.keys(updates).length === 0) return;
  sceneManager.updateEntity(grip.entityId, updates as unknown as Partial<SceneEntity>);
}

/**
 * ADR-359 Phase 11 — Ray grip commit via `applyRayGripDrag` + direct scene
 * patch. Mirrors `commitXLineGripDrag` for semi-infinite lines.
 */
export function commitRayGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.rayGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'ray') return;
  const entity = raw as unknown as RayEntity;
  const currentPos: Point2D = { x: grip.position.x + delta.x, y: grip.position.y + delta.y };
  const updates = applyRayGripDrag(grip.rayGripKind, { entity, delta, currentPos });
  if (Object.keys(updates).length === 0) return;
  sceneManager.updateEntity(grip.entityId, updates as unknown as Partial<SceneEntity>);
}

/** ADR-362 Phase I2 — Dimension grip commit via `applyDimensionGripDrag` + scene patch. */
export function commitDimensionGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.dimGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw || (raw as Record<string, unknown>).type !== 'dimension') return;
  const dxfDim = raw as unknown as DxfDimension;
  const newDimEntity = applyDimensionGripDrag(grip.dimGripKind, dxfDim.dimensionEntity, delta, grip.position);
  if (newDimEntity === dxfDim.dimensionEntity) return;
  sceneManager.updateEntity(grip.entityId, { dimensionEntity: newDimEntity } as unknown as Partial<SceneEntity>);
}

