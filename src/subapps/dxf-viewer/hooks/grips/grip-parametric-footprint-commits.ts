/**
 * Polygon-footprint parametric grip commits (slab / roof / slab-opening /
 * floor-finish).
 *
 * Extracted from grip-parametric-commits.ts (N.7.1 file-size split). Each handler
 * shares the per-vertex-translate + edge-midpoint-insertion pattern: the entity is
 * parametric (geometry derived from a vertex outline), Shift drives the
 * rectilinear constraint via `ShiftKeyTracker`, and the dedicated UpdateXParams
 * command recomputes geometry atomically. Merge window (ADR-031) collapses a
 * continuous drag into one undo entry. Re-exported from grip-parametric-commits.ts
 * so the commit API stays one import.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import type { HatchEntity } from '../../types/entities';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { RoofEntity } from '../../bim/types/roof-types';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import { UpdateSlabOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';
import { UpdateRoofParamsCommand } from '../../core/commands/entity-commands/UpdateRoofParamsCommand';
import { UpdateFloorFinishParamsCommand } from '../../core/commands/entity-commands/UpdateFloorFinishParamsCommand';
import { UpdateHatchBoundaryCommand } from '../../core/commands/entity-commands/UpdateHatchBoundaryCommand';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import { applyHatchGripDrag } from '../../bim/hatch/hatch-grips';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { createSceneManagerAdapter } from './grip-commit-adapters';

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
  emitBimEntityParamsUpdated('slab', grip.entityId);
}

/**
 * ADR-417 Φ1-part-2 #2 — Parametric roof grip commit (per-vertex translate +
 * edge-midpoint insertion, Revit «Edit Footprint»). Mirrors `commitSlabGripDrag`
 * semantics: routes through `applyRoofGripDrag()` + `UpdateRoofParamsCommand` so
 * geometry (faces / ridges / areas / bbox) + validation recompute atomically and
 * the merge window (ADR-031) collapses a continuous drag into one undo entry.
 * Emits `bim:roof-params-updated` after dispatch so consumers (auto-save / BOQ
 * feed) react. Shift drives rectilinear quantization via the `ShiftKeyTracker`
 * (mirror slab Phase 3.6). The `edges` array is kept in lockstep with
 * `outline.vertices` inside `applyRoofGripDrag` — `UpdateRoofParamsCommand`
 * rejects any length mismatch.
 */
export function commitRoofGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.roofGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<RoofEntity>;
  if (candidate.type !== 'roof' || !candidate.params) return;
  const roof = candidate as RoofEntity;
  const originalParams = roof.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applyRoofGripDrag(grip.roofGripKind, {
    originalParams,
    delta,
    rectilinear,
  });
  if (newParams === originalParams) return;
  const command = new UpdateRoofParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('roof', grip.entityId);
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
  emitBimEntityParamsUpdated('slab-opening', grip.entityId);
}

/**
 * ADR-419 — Parametric floor-finish grip commit (per-vertex translate +
 * edge-midpoint insertion). Mirrors `commitSlabGripDrag` / `commitRoofGripDrag`
 * semantics: routes through `applyFloorFinishGripDrag()` +
 * `UpdateFloorFinishParamsCommand` so geometry + validation recompute atomically
 * and the merge window (ADR-031) collapses a continuous drag into one undo
 * entry. Shift drives rectilinear constraint via `ShiftKeyTracker`.
 */
export function commitFloorFinishGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.floorFinishGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FloorFinishEntity>;
  if (candidate.type !== 'floor-finish' || !candidate.params) return;
  const finish = candidate as FloorFinishEntity;
  const originalParams = finish.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applyFloorFinishGripDrag(grip.floorFinishGripKind, {
    originalParams,
    delta,
    rectilinear,
  });
  if (newParams === originalParams) return;
  const command = new UpdateFloorFinishParamsCommand(
    grip.entityId,
    newParams,
    originalParams,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
  emitBimEntityParamsUpdated('floor-finish', grip.entityId);
}

/**
 * ADR-507 — Hatch boundary grip commit (per-vertex translate on `boundaryPaths`).
 * Mirrors `commitFloorFinishGripDrag` but the hatch is a FLAT primitive (no
 * params/geometry) → routes through `applyHatchGripDrag()` +
 * `UpdateHatchBoundaryCommand`. The merge window (ADR-031) collapses a continuous
 * drag into one undo entry. Shift drives rectilinear constraint via
 * `ShiftKeyTracker`. No `emitBimEntityParamsUpdated` — the hatch is not a BIM
 * params entity; `useHatchPersistence` auto-saves the patched boundaryPaths.
 */
export function commitHatchGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  if (!grip.entityId || !grip.hatchGripKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<HatchEntity>;
  if (candidate.type !== 'hatch' || !candidate.boundaryPaths) return;
  const original = candidate.boundaryPaths;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newBoundaryPaths = applyHatchGripDrag(grip.hatchGripKind, {
    originalBoundaryPaths: original,
    delta,
    rectilinear,
  });
  if (newBoundaryPaths === original) return;
  const command = new UpdateHatchBoundaryCommand(
    grip.entityId,
    newBoundaryPaths,
    original,
    sceneManager,
    true,
  );
  if (command.validate() !== null) return;
  deps.execute(command);
}
