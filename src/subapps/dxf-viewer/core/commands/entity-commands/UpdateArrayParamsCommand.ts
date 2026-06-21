/**
 * UPDATE ARRAY PARAMS COMMAND — ADR-353 Session A2
 *
 * Patches params on an existing ArrayEntity. The array stores no derived
 * geometry on the entity (instances are expanded on demand), so this only
 * writes the new `params`.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * rapid grip-drag updates collapse into a single undo history entry.
 */

import type { ISceneManager } from '../interfaces';
import type { ArrayParams } from '../../../systems/array/types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateArrayParamsCommand extends MergeableUpdateCommand<ArrayParams> {
  readonly name = 'UpdateArrayParams';
  readonly type = 'update-array-params';

  constructor(
    arrayId: string,
    params: ArrayParams,
    previousParams: ArrayParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(arrayId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: ArrayParams): void {
    this.sceneManager.updateEntity(this.entityId, { params } as Record<string, unknown>);
  }

  protected withMergedPatch(nextPatch: ArrayParams): UpdateArrayParamsCommand {
    // Keep earliest previousParams (this) and latest params (other).
    return new UpdateArrayParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update array params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Array entity ID is required';
    return null;
  }
}
