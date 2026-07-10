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
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
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
import { UpdateHatchOriginCommand } from '../../core/commands/entity-commands/UpdateHatchOriginCommand';
import { UpdateHatchGradientCommand } from '../../core/commands/entity-commands/UpdateHatchGradientCommand';
import { applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { applySlabOpeningGripDrag } from '../../bim/slab-openings/slab-opening-grips';
import { applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { applyFloorFinishGripDrag } from '../../bim/floor-finishes/floor-finish-grips';
import {
  applyHatchGripDrag, applyHatchOriginGripDrag, isHatchOriginGripKind, hatchBoundsCenter,
  isHatchAngleGripKind, hatchGradientAngleGripPos, applyHatchAngleGripDrag,
  isHatchMoveKind, isHatchRotationKind,
} from '../../bim/hatch/hatch-grips';
import { withGradientPatch, DEFAULT_GRADIENT_DEFAULTS } from '../../bim/hatch/hatch-gradient-build';
import { emitBimEntityParamsUpdated } from '../../systems/events/emit-bim-entity-params-updated';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { createSceneManagerAdapter, commitWholeEntityMove } from './grip-commit-adapters';
import { gripKindOf } from '../grip-kinds';
// ADR-627 — whole-hatch ROTATION reuses the SHARED pivot/anchor/swept-angle resolver + the
// canonical RotateEntityCommand (rotateEntity case 'hatch'), exactly like the polyline/area outline.
import { resolveRotation } from './grip-primitive-rotate-commits';
import { RotateEntityCommand } from '../../core/commands/entity-commands/RotateEntityCommand';
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';

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
  const slabKind = gripKindOf(grip, 'slab');
  if (!grip.entityId || !slabKind) return;
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
  const newParams = applySlabGripDrag(slabKind, {
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
  const roofKind = gripKindOf(grip, 'roof');
  if (!grip.entityId || !roofKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<RoofEntity>;
  if (candidate.type !== 'roof' || !candidate.params) return;
  const roof = candidate as RoofEntity;
  const originalParams = roof.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applyRoofGripDrag(roofKind, {
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
  const slabOpeningKind = gripKindOf(grip, 'slab-opening');
  if (!grip.entityId || !slabOpeningKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<SlabOpeningEntity>;
  if (candidate.type !== 'slab-opening' || !candidate.params) return;
  const opening = candidate as SlabOpeningEntity;
  const originalParams = opening.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applySlabOpeningGripDrag(slabOpeningKind, {
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
  const floorFinishKind = gripKindOf(grip, 'floor-finish');
  if (!grip.entityId || !floorFinishKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<FloorFinishEntity>;
  if (candidate.type !== 'floor-finish' || !candidate.params) return;
  const finish = candidate as FloorFinishEntity;
  const originalParams = finish.params;
  const rectilinear = ShiftKeyTracker.getSnapshot();
  const newParams = applyFloorFinishGripDrag(floorFinishKind, {
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
  const hatchKind = gripKindOf(grip, 'hatch');
  if (!grip.entityId || !hatchKind) return;
  const sceneManager = createSceneManagerAdapter(deps);
  if (!sceneManager) return;
  const raw = sceneManager.getEntity(grip.entityId);
  if (!raw) return;
  const candidate = raw as unknown as Partial<HatchEntity>;
  if (candidate.type !== 'hatch' || !candidate.boundaryPaths) return;
  // ADR-627 — whole-hatch MOVE cross → translate the whole hatch (boundaryPaths + seed
  // points via `calculateMovedGeometry` case 'hatch') through the SHARED whole-entity move
  // SSoT (the SAME `commitWholeEntityMove` the group / annotation-symbol move crosses use;
  // Ctrl/«Copy» clones with the same base point). Handled HERE because
  // `tryCommitParametricGripDrag` routes EVERY `on:'hatch'` grip to this handler first.
  if (isHatchMoveKind(hatchKind)) {
    commitWholeEntityMove(grip, delta, deps, isGripCopyIntent());
    return;
  }
  // ADR-627 — whole-hatch ROTATION handle → rotate the boundaryPaths about the pivot via the
  // canonical `RotateEntityCommand` (`rotateEntity` case 'hatch'), exactly like the polyline/
  // area outline (`commitPolylineRotationGripDrag`). Pivot = the hot-grip picked centre
  // (published in `BimRotateHotGripStore`, resolved by the SHARED `resolveRotation`) or the
  // boundary bbox centre. Ctrl/«Copy» → rotate a CLONE (`RotateEntityCommand.copyMode`).
  if (isHatchRotationKind(hatchKind)) {
    const pivotFallback = hatchBoundsCenter(candidate.boundaryPaths);
    if (!pivotFallback) return;
    const res = resolveRotation(grip, delta, pivotFallback);
    if (!res) return;
    const command = new RotateEntityCommand(
      [grip.entityId], res.pivot, res.sweptDeg, sceneManager, false, isGripCopyIntent(),
    );
    if (command.validate() !== null) return;
    deps.execute(command);
    return;
  }
  const rectilinear = ShiftKeyTracker.getSnapshot();
  // ADR-507 Φ5 A3 — gradient origin/seed grip: patch το patternOrigin (mergeable
  // drag → ΕΝΑ undo), ΟΧΙ το όριο. Default origin = κέντρο bbox (ίδιο SSoT).
  if (isHatchOriginGripKind(hatchKind)) {
    const current = candidate.patternOrigin ?? hatchBoundsCenter(candidate.boundaryPaths);
    if (!current) return;
    const newOrigin = applyHatchOriginGripDrag(current, { delta, rectilinear });
    if (newOrigin.x === current.x && newOrigin.y === current.y) return;
    const originCommand = new UpdateHatchOriginCommand(
      grip.entityId, newOrigin, current, sceneManager, true,
    );
    if (originCommand.validate() !== null) return;
    deps.execute(originCommand);
    return;
  }
  // ADR-507 Φ5 A4 — gradient-angle βραχίονας: περιστρέφει το gradient.angleDeg (mergeable
  // drag → ΕΝΑ undo). Η νέα γωνία = atan2(anchor+delta − origin)· anchor = SSoT θέση λαβής.
  if (isHatchAngleGripKind(hatchKind)) {
    const gradient = candidate.gradient;
    if (!gradient) return;
    const origin = candidate.patternOrigin ?? hatchBoundsCenter(candidate.boundaryPaths);
    if (!origin) return;
    const anchor = hatchGradientAngleGripPos(origin, gradient.angleDeg ?? 0, candidate.boundaryPaths);
    if (!anchor) return;
    // Shift → snap σε 15° (ίδιο modifier με το rectilinear των άλλων hatch grips).
    const newAngle = applyHatchAngleGripDrag(origin, translatePoint(anchor, delta), rectilinear);
    if (newAngle === (gradient.angleDeg ?? 0)) return;
    const newGradient = withGradientPatch(gradient, DEFAULT_GRADIENT_DEFAULTS, { field: 'angleDeg', value: newAngle });
    const angleCommand = new UpdateHatchGradientCommand(
      grip.entityId, newGradient, gradient, sceneManager, true,
    );
    if (angleCommand.validate() !== null) return;
    deps.execute(angleCommand);
    return;
  }
  const original = candidate.boundaryPaths;
  const newBoundaryPaths = applyHatchGripDrag(hatchKind, {
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
