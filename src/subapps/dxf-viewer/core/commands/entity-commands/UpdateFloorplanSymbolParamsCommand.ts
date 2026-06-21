/**
 * UPDATE FLOORPLAN SYMBOL PARAMS COMMAND — ADR-415.
 *
 * Patches `params` on an existing `FloorplanSymbolEntity` and recomputes
 * `geometry` + `validation` atomically via `computeFloorplanSymbolGeometry()` +
 * `validateFloorplanSymbolParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { FloorplanSymbolGeometry, FloorplanSymbolParams } from '../../../bim/types/floorplan-symbol-types';
import { computeFloorplanSymbolGeometry, validateFloorplanSymbolParams } from '../../../bim/floorplan-symbols/floorplan-symbol-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateFloorplanSymbolParamsCommand extends MergeableUpdateCommand<FloorplanSymbolParams> {
  readonly name = 'UpdateFloorplanSymbolParams';
  readonly type = 'update-floorplan-symbol-params';

  constructor(
    symbolId: string,
    params: FloorplanSymbolParams,
    previousParams: FloorplanSymbolParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(symbolId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: FloorplanSymbolParams): void {
    const geometry: FloorplanSymbolGeometry = computeFloorplanSymbolGeometry(params);
    const validation = validateFloorplanSymbolParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: FloorplanSymbolParams): UpdateFloorplanSymbolParamsCommand {
    return new UpdateFloorplanSymbolParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update floorplan symbol params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Floorplan symbol entity ID is required';
    if (this.patch.widthMm <= 0) return 'widthMm must be > 0';
    if (this.patch.depthMm <= 0) return 'depthMm must be > 0';
    if (!Number.isFinite(this.patch.rotationDeg)) return 'rotationDeg must be finite';
    return null;
  }
}
