/**
 * UPDATE SLAB PARAMS COMMAND — ADR-363 Phase 3.5.
 *
 * Patches `params` on an existing `SlabEntity` and recomputes `geometry` +
 * `validation` atomically via `computeSlabGeometry()` + `validateSlabParams()`
 * so renderer reads never diverge from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Root `kind` field is kept in sync με `params.kind` so the ribbon's kind switch
 * remains undoable.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { SlabGeometry, SlabParams } from '../../../bim/types/slab-types';
import { computeSlabGeometry } from '../../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../../bim/validators/slab-validator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateSlabParamsCommand extends MergeableUpdateCommand<SlabParams> {
  readonly name = 'UpdateSlabParams';
  readonly type = 'update-slab-params';

  constructor(
    slabId: string,
    params: SlabParams,
    previousParams: SlabParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(slabId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: SlabParams): void {
    const geometry: SlabGeometry = computeSlabGeometry(params);
    const validation = validateSlabParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: SlabParams): UpdateSlabParamsCommand {
    return new UpdateSlabParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update slab params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Slab entity ID is required';
    if (!this.patch.outline || this.patch.outline.vertices.length < 3) {
      return 'outline must have at least 3 vertices';
    }
    if (this.patch.thickness <= 0) return 'thickness must be > 0';
    return null;
  }
}
