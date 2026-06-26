/**
 * UPDATE WALL PARAMS COMMAND — ADR-363 Phase 1B.
 *
 * Patches `params` on an existing `WallEntity` and recomputes `geometry` +
 * `validation` atomically via `computeWallGeometry()` + `validateWallParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * The wall carries a CONSTANT `kind` discriminator (not part of the directional
 * patch — same for forward/undo) used by `computeWallGeometry`; it is threaded
 * through `withMergedPatch` and `serializedData` to preserve behaviour.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.9 §6
 */

import type { ISceneManager } from '../interfaces';
import type { WallGeometry, WallKind, WallParams } from '../../../bim/types/wall-types';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import { validateWallParams } from '../../../bim/validators/wall-validator';
// ADR-412/414 — auto family-type policy (SSoT). A cross-section edit (thickness/dna)
// must re-flow the AUTO link, otherwise «type always wins» (docToEntity) overwrites
// the new params from the stale built-in on reload → the edit "doesn't save".
import { resolveAutoWallTypeId } from '../../../bim/family-types/wall-type-auto-assign';
import { isBuiltInWallTypeId } from '../../../bim/family-types/built-in-types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateWallParamsCommand extends MergeableUpdateCommand<WallParams> {
  readonly name = 'UpdateWallParams';
  readonly type = 'update-wall-params';

  private readonly kind: WallKind;

  constructor(
    wallId: string,
    params: WallParams,
    previousParams: WallParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
    kind: WallKind = 'straight',
  ) {
    super(wallId, params, previousParams, sceneManager, isDragging);
    this.kind = kind;
  }

  protected applyPatch(params: WallParams): void {
    const geometry: WallGeometry = computeWallGeometry(params, this.kind);
    const validation = validateWallParams(params).bimValidation;
    const updates: Record<string, unknown> = { params, geometry, validation };
    // ADR-412/414 — re-flow the AUTO family-type link from the NEW cross-section.
    // Without this, a thickness/dna edit leaves the wall pointing at its original
    // read-only built-in type, so on reload `docToEntity` re-resolves params from
    // that type («type always wins») and the edit silently reverts. We re-run the
    // SAME creation-time policy (`resolveAutoWallTypeId`): a still-matching seed
    // relinks to its built-in (effective === params → no revert), a customised
    // cross-section detaches to ad-hoc (`undefined` → reload keeps the instance
    // params). Symmetric on undo (previousPatch re-resolves the original link).
    // Scoped to AUTO-linked / untyped walls — a user-assigned CUSTOM type is left
    // untouched (it owns its own lifecycle; «type always wins» is intentional there).
    const prev = this.sceneManager.getEntity(this.entityId) as
      | { typeId?: string }
      | undefined;
    if (isBuiltInWallTypeId(prev?.typeId) || !prev?.typeId) {
      updates.typeId = resolveAutoWallTypeId(params);
      // AUTO-linked walls never carry per-instance overrides (a customised wall is
      // ad-hoc). Clear any so a detached/relinked wall persists a clean link.
      updates.typeOverrides = undefined;
    }
    this.sceneManager.updateEntity(this.entityId, updates);
    // ADR-540 — hosted openings (+ any other scene-derived dependent) are recomputed against the
    // now-updated wall by the `MergeableUpdateCommand` base reconcile (former inline
    // `cascadeHostedOpeningsForWalls` call, now the universal SSoT).
  }

  protected withMergedPatch(nextPatch: WallParams): UpdateWallParamsCommand {
    return new UpdateWallParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
      this.kind,
    );
  }

  getDescription(): string {
    return `Update wall params (${this.patch.category})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Wall entity ID is required';
    if (this.patch.thickness <= 0) return 'thickness must be > 0';
    if (this.patch.height <= 0) return 'height must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    // Canonical base shape + Wall's genuine extra state (the geometry `kind`).
    return { ...this.baseSerializedData(), kind: this.kind };
  }
}
