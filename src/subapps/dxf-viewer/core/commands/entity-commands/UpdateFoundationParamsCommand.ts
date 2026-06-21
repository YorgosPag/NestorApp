/**
 * UPDATE FOUNDATION PARAMS COMMAND — ADR-436 Slice 1.
 *
 * Patches `params` on an existing `FoundationEntity` and recomputes `geometry` +
 * `validation` atomically via `computeFoundationGeometry()` +
 * `validateFoundationParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * Root `kind` field is kept in sync με `params.kind`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { FoundationGeometry, FoundationParams } from '../../../bim/types/foundation-types';
import { computeFoundationGeometry } from '../../../bim/geometry/foundation-geometry';
import { validateFoundationParams } from '../../../bim/validators/foundation-validator';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateFoundationParamsCommand extends MergeableUpdateCommand<FoundationParams> {
  readonly name = 'UpdateFoundationParams';
  readonly type = 'update-foundation-params';

  constructor(
    foundationId: string,
    params: FoundationParams,
    previousParams: FoundationParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(foundationId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: FoundationParams): void {
    const geometry: FoundationGeometry = computeFoundationGeometry(params);
    const validation = validateFoundationParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: FoundationParams): UpdateFoundationParamsCommand {
    return new UpdateFoundationParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update foundation params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Foundation entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.kind === 'pad' && this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.thicknessMm <= 0) return 'thickness must be > 0';
    if (!Number.isFinite(this.patch.topElevationMm)) return 'topElevation must be finite';
    return null;
  }
}
