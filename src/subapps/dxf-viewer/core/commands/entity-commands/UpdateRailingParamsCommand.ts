/**
 * UPDATE RAILING PARAMS COMMAND — ADR-407.
 *
 * Patches `params` on an existing `RailingEntity` and recomputes `geometry` +
 * `validation` atomically via `computeRailingGeometry()` +
 * `validateRailingParams()` so renderer reads never diverge from the parametric
 * source of truth (PATH ⊥ TYPE → derived geometry).
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8) —
 * consecutive grip-drag samples collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { RailingGeometry, RailingParams } from '../../../bim/types/railing-types';
import { computeRailingGeometry, validateRailingParams } from '../../../bim/railings/railing-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateRailingParamsCommand extends MergeableUpdateCommand<RailingParams> {
  readonly name = 'UpdateRailingParams';
  readonly type = 'update-railing-params';

  constructor(
    railingId: string,
    params: RailingParams,
    previousParams: RailingParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(railingId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: RailingParams): void {
    const geometry: RailingGeometry = computeRailingGeometry(params);
    const validation = validateRailingParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: 'railing',
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: RailingParams): UpdateRailingParamsCommand {
    return new UpdateRailingParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update railing params (${this.patch.type.predefinedType})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Railing entity ID is required';
    if (this.patch.totalHeightMm <= 0) return 'totalHeightMm must be > 0';
    if (this.patch.type.balusterPlacement.pattern.spacingMm <= 0) {
      return 'baluster spacing must be > 0';
    }
    if (!Number.isFinite(this.patch.baseElevationMm)) return 'baseElevationMm must be finite';
    return null;
  }
}
