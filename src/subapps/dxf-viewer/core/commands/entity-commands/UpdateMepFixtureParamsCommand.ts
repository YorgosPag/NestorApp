/**
 * UPDATE MEP FIXTURE PARAMS COMMAND — ADR-406.
 *
 * Patches `params` on an existing `MepFixtureEntity` and recomputes `geometry`
 * + `validation` atomically via `computeMepFixtureGeometry()` +
 * `validateMepFixtureParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { MepFixtureGeometry, MepFixtureParams } from '../../../bim/types/mep-fixture-types';
import { computeMepFixtureGeometry, validateMepFixtureParams } from '../../../bim/mep-fixtures/mep-fixture-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepFixtureParamsCommand extends MergeableUpdateCommand<MepFixtureParams> {
  readonly name = 'UpdateMepFixtureParams';
  readonly type = 'update-mep-fixture-params';

  constructor(
    fixtureId: string,
    params: MepFixtureParams,
    previousParams: MepFixtureParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(fixtureId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepFixtureParams): void {
    const geometry: MepFixtureGeometry = computeMepFixtureGeometry(params);
    const validation = validateMepFixtureParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: MepFixtureParams): UpdateMepFixtureParamsCommand {
    return new UpdateMepFixtureParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP fixture params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP fixture entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.shape === 'rectangular' && this.patch.length <= 0) {
      return 'length must be > 0';
    }
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }
}
