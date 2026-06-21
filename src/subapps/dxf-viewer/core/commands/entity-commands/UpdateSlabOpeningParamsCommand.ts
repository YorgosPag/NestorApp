/**
 * UPDATE SLAB-OPENING PARAMS COMMAND — ADR-363 Phase 3.7.
 *
 * Patches `params` on existing `SlabOpeningEntity` και recomputes `geometry`
 * + `validation` atomically via `computeSlabOpeningGeometry()` +
 * `validateSlabOpeningParams()` ώστε ο renderer να μην αποκλίνει ποτέ από
 * τον parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Host-slab lookup re-resolved σε κάθε execute/undo/redo via
 * `sceneManager.getEntity(slabId)` ώστε η γεωμετρία να μένει σωστή ακόμα
 * κι αν το host slab επεξεργαστεί ανεξάρτητα.
 *
 * Soft-orphan policy (ADR-363 §5.5 §11.Q3): αν το host slab λείπει σε
 * execute time, το patch εφαρμόζεται αλλά geometry/validation επαναχρησιμοποιούν
 * το προηγούμενο known state — η persistence layer ξανα-υδραγωγεί όταν
 * έρθει το slab.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  SlabOpeningGeometry,
  SlabOpeningParams,
} from '../../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../../bim/types/slab-types';
import { computeSlabOpeningGeometry } from '../../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../../bim/validators/slab-opening-validator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateSlabOpeningParamsCommand extends MergeableUpdateCommand<SlabOpeningParams> {
  readonly name = 'UpdateSlabOpeningParams';
  readonly type = 'update-slab-opening-params';

  constructor(
    slabOpeningId: string,
    params: SlabOpeningParams,
    previousParams: SlabOpeningParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(slabOpeningId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: SlabOpeningParams): void {
    const host = this.resolveHostSlab(params.slabId);
    const patch: Record<string, unknown> = { params };
    const geometry: SlabOpeningGeometry = computeSlabOpeningGeometry(params);
    patch.geometry = geometry;
    if (host) {
      const validation = validateSlabOpeningParams(params, host).bimValidation;
      patch.validation = validation;
    } else {
      // Soft-orphan: intrinsic validation only (no host-relative checks).
      const validation = validateSlabOpeningParams(params, null).bimValidation;
      patch.validation = validation;
    }
    this.sceneManager.updateEntity(this.entityId, patch as Partial<SceneEntity>);
  }

  private resolveHostSlab(slabId: string): SlabEntity | null {
    const raw = this.sceneManager.getEntity(slabId);
    if (!raw) return null;
    const candidate = raw as unknown as Partial<SlabEntity>;
    if (candidate.type !== 'slab' || !candidate.params || !candidate.geometry) return null;
    return candidate as SlabEntity;
  }

  protected withMergedPatch(nextPatch: SlabOpeningParams): UpdateSlabOpeningParamsCommand {
    return new UpdateSlabOpeningParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update slab-opening params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Slab-opening entity ID is required';
    if (!this.patch.slabId) return 'Slab-opening params.slabId is required';
    if (!this.patch.outline || this.patch.outline.vertices.length < 3) {
      return 'Slab-opening outline must have >= 3 vertices';
    }
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      slabOpeningId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
