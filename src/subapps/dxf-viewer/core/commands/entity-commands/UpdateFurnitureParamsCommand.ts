/**
 * UPDATE FURNITURE PARAMS COMMAND — ADR-410.
 *
 * Patches `params` on an existing `FurnitureEntity` and recomputes `geometry`
 * + `validation` atomically via `computeFurnitureGeometry()` +
 * `validateFurnitureParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { FurnitureGeometry, FurnitureParams } from '../../../bim/types/furniture-types';
import { computeFurnitureGeometry, validateFurnitureParams } from '../../../bim/furniture/furniture-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateFurnitureParamsCommand extends MergeableUpdateCommand<FurnitureParams> {
  readonly name = 'UpdateFurnitureParams';
  readonly type = 'update-furniture-params';

  constructor(
    furnitureId: string,
    params: FurnitureParams,
    previousParams: FurnitureParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(furnitureId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: FurnitureParams): void {
    const geometry: FurnitureGeometry = computeFurnitureGeometry(params);
    const validation = validateFurnitureParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: FurnitureParams): UpdateFurnitureParamsCommand {
    return new UpdateFurnitureParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update furniture params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Furniture entity ID is required';
    if (this.patch.widthMm <= 0) return 'widthMm must be > 0';
    if (this.patch.depthMm <= 0) return 'depthMm must be > 0';
    if (this.patch.heightMm <= 0) return 'heightMm must be > 0';
    if (!Number.isFinite(this.patch.rotationDeg)) return 'rotationDeg must be finite';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      furnitureId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
