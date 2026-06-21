/**
 * UPDATE FLOOR FINISH PARAMS COMMAND — ADR-419.
 *
 * Patches `params` on an existing `FloorFinishEntity` and recomputes
 * `geometry` atomically via `computeFloorFinishGeometry()` so the renderer
 * never reads stale data.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive drag samples collapse into a single undo entry within the merge
 * window. `useFloorFinishPersistence` picks up the patched entity via debounced
 * auto-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { FloorFinishParams } from '../../../bim/types/floor-finish-types';
import { computeFloorFinishGeometry } from '../../../bim/types/floor-finish-types';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateFloorFinishParamsCommand extends MergeableUpdateCommand<FloorFinishParams> {
  readonly name = 'UpdateFloorFinishParams';
  readonly type = 'update-floor-finish-params';

  constructor(
    finishId: string,
    params: FloorFinishParams,
    previousParams: FloorFinishParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(finishId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: FloorFinishParams): void {
    const geometry = computeFloorFinishGeometry(params);
    const validation = { hasCodeViolations: false, violationKeys: [] as string[], lastValidatedAt: null };
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: FloorFinishParams): UpdateFloorFinishParamsCommand {
    return new UpdateFloorFinishParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update floor finish params (${this.patch.materialId})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Floor finish entity ID is required';
    if (!this.patch.footprint || this.patch.footprint.vertices.length < 3) {
      return 'footprint must have at least 3 vertices';
    }
    if (this.patch.thicknessMm <= 0) return 'thicknessMm must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      finishId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
