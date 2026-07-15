/**
 * UPDATE OPENING PARAMS COMMAND — ADR-363 Phase 2.5.
 *
 * Patches `params` on an existing `OpeningEntity` and recomputes `geometry` +
 * `validation` atomically via `computeOpeningGeometry()` +
 * `validateOpeningParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive drag samples within the merge window collapse into a single undo
 * entry. Host-wall lookup is re-resolved on each execute/undo/redo via
 * `sceneManager.getEntity(wallId)` so the geometry stays correct even if the
 * host wall is independently edited between samples.
 *
 * Soft-orphan policy (ADR-363 §5.4): if the host wall is missing at execute
 * time, the patch still applies but geometry/validation reuse the
 * previous-known state — the persistence layer re-hydrates once the host wall
 * arrives.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4 §6
 */

import type { ISceneManager } from '../interfaces';
import type { OpeningParams } from '../../../bim/types/opening-types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';
import { applyOpeningDerivedPatch, validateOpeningHostRef } from './opening-derived-state';
import type { SceneUnits } from '../../../utils/scene-units';

export class UpdateOpeningParamsCommand extends MergeableUpdateCommand<OpeningParams> {
  readonly name = 'UpdateOpeningParams';
  readonly type = 'update-opening-params';

  constructor(
    openingId: string,
    params: OpeningParams,
    previousParams: OpeningParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
    // ADR-615 — self-hosted geometry recompute needs the scene's mm↔scene factor
    // (no host wall to read it from). Canonical-mm scenes default to 'mm'.
    private readonly sceneUnits: SceneUnits = 'mm',
  ) {
    super(openingId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: OpeningParams): void {
    // ADR-363 §5.4 — the shared writer keeps the DERIVED discriminators
    // (`kind`/`ifcType`) in lock-step with `params.kind` (a kind change patching
    // only `params` would leave the renderer on a stale `kind`). ADR-615 §Decision 1
    // — it also recomputes geometry from the self-host / wall-host / soft-orphan
    // branch, so a move/resize/rotation grip drag re-derives outline/position/rotation.
    applyOpeningDerivedPatch(this.sceneManager, this.entityId, params, this.sceneUnits);
  }

  protected withMergedPatch(nextPatch: OpeningParams): UpdateOpeningParamsCommand {
    return new UpdateOpeningParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
      // ADR-615 — thread sceneUnits so a merged self-hosted drag sample keeps
      // recomputing geometry with the correct mm↔scene factor.
      this.sceneUnits,
    );
  }

  getDescription(): string {
    return `Update opening params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Opening entity ID is required';
    // ADR-615 — an opening is hosted by EXACTLY ONE of: a wall (`wallId`) or a
    // free-standing self-host (`selfHost`). Requiring `wallId` unconditionally
    // silently rejected every self-hosted grip commit (move/resize/rotation → no-op).
    const hostError = validateOpeningHostRef(this.patch);
    if (hostError) return hostError;
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.height <= 0) return 'height must be > 0';
    if (this.patch.offsetFromStart < 0) return 'offsetFromStart must be >= 0';
    return null;
  }
}
