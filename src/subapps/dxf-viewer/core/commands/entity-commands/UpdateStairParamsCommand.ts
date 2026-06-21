/**
 * UPDATE STAIR PARAMS COMMAND — ADR-358 Phase 5b (G15).
 *
 * Patches `params` on an existing `StairEntity` and recomputes `geometry`
 * atomically via `computeStairGeometry()` so renderer reads never diverge
 * from the parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive drag samples collapse into a single undo entry. This is the commit
 * path used by `commitDxfGripDragModeAware` when the active grip carries a
 * `stairGripKind`.
 */

import type { ISceneManager } from '../interfaces';
import type { StairGeometry, StairParams } from '../../../bim/types/stair-types';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
// ADR-358 Phase 6.1 — re-validate on every grip/edit commit so the red
// badge (Phase 7b1) reflects the live state and the user sees overflow
// warnings the moment they exceed code/story-height limits.
import { validateStairParams } from '../../../bim/stairs/stair-validator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateStairParamsCommand extends MergeableUpdateCommand<StairParams> {
  readonly name = 'UpdateStairParams';
  readonly type = 'update-stair-params';

  constructor(
    stairId: string,
    params: StairParams,
    previousParams: StairParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(stairId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: StairParams): void {
    const geometry: StairGeometry = computeStairGeometry(params);
    const validation = validateStairParams(params);
    this.sceneManager.updateEntity(this.entityId, {
      params,
      geometry,
      validation,
    } as unknown as Record<string, unknown>);
  }

  protected withMergedPatch(nextPatch: StairParams): UpdateStairParamsCommand {
    return new UpdateStairParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update stair params (${this.patch.variant.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Stair entity ID is required';
    if (this.patch.stepCount < 2) return 'stepCount must be >= 2';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.tread <= 0) return 'tread must be > 0';
    if (this.patch.rise <= 0) return 'rise must be > 0';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      stairId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
