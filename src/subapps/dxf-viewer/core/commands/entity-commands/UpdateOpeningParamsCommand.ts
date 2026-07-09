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

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  OpeningGeometry,
  OpeningParams,
} from '../../../bim/types/opening-types';
import { isSelfHostedOpening } from '../../../bim/types/opening-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { selfOpeningHost } from '../../../bim/geometry/opening-host';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';
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
    // ADR-363 §5.4 — keep the DERIVED top-level discriminator (`kind` + `ifcType`)
    // in lock-step with `params.kind` (single source of truth). A kind change that
    // patched only `params` would leave the renderer dispatching on a stale `kind`
    // (door overlay on window geometry → no symbol, "continuous wall" bug).
    const patch: Record<string, unknown> = {
      params,
      kind: params.kind,
      ifcType: inferOpeningIfcType(params.kind),
    };
    if (isSelfHostedOpening(params)) {
      // ADR-615 §Decision 1 — self-hosted: recompute geometry from the synthetic
      // host (SAME engine as creation/hydration), so a move/resize/rotation grip
      // drag actually re-derives `outline`/`position`/`rotation`. Without this the
      // params changed but geometry stayed stale → the symbol never visibly moved.
      const host = selfOpeningHost(params, this.sceneUnits);
      patch.geometry = computeOpeningGeometry(params, host, this.sceneUnits);
      patch.validation = validateOpeningParams(params, null).bimValidation;
    } else {
      const host = this.resolveHostWall(params.wallId);
      if (host) {
        const geometry: OpeningGeometry = computeOpeningGeometry(params, host, host.params.sceneUnits ?? 'mm');
        const validation = validateOpeningParams(params, host).bimValidation;
        patch.geometry = geometry;
        patch.validation = validation;
      } else {
        // Soft-orphan: intrinsic validation only (no host-relative checks).
        const validation = validateOpeningParams(params, null).bimValidation;
        patch.validation = validation;
      }
    }
    this.sceneManager.updateEntity(this.entityId, patch as Partial<SceneEntity>);
  }

  private resolveHostWall(wallId: string | undefined): WallEntity | null {
    if (!wallId) return null;
    const raw = this.sceneManager.getEntity(wallId);
    if (!raw) return null;
    const candidate = raw as unknown as Partial<WallEntity>;
    if (candidate.type !== 'wall' || !candidate.params || !candidate.geometry) return null;
    return candidate as WallEntity;
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
    if (!this.patch.wallId && !this.patch.selfHost) {
      return 'Opening requires a host (params.wallId or params.selfHost)';
    }
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.height <= 0) return 'height must be > 0';
    if (this.patch.offsetFromStart < 0) return 'offsetFromStart must be >= 0';
    return null;
  }
}
