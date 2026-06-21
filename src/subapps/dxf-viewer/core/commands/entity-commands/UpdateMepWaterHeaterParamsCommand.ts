/**
 * UPDATE MEP WATER HEATER PARAMS COMMAND — ADR-408 DHW.
 *
 * Patches `params` on an existing `MepWaterHeaterEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepWaterHeaterGeometry()` +
 * `validateMepWaterHeaterParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * On execute / undo / redo emits `'bim:mep-water-heater-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  MepWaterHeaterGeometry,
  MepWaterHeaterParams,
} from '../../../bim/types/mep-water-heater-types';
import {
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../../../bim/mep-water-heaters/mep-water-heater-geometry';
import { buildWaterHeaterConnectors } from '../../../bim/mep-water-heaters/mep-water-heater-geometry';
import { EventBus } from '../../../systems/events/EventBus';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepWaterHeaterParamsCommand extends MergeableUpdateCommand<MepWaterHeaterParams> {
  readonly name = 'UpdateMepWaterHeaterParams';
  readonly type = 'update-mep-water-heater-params';

  constructor(
    waterHeaterId: string,
    params: MepWaterHeaterParams,
    previousParams: MepWaterHeaterParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(waterHeaterId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepWaterHeaterParams): void {
    // Re-seed the two connectors so a width change keeps the cold-inlet / hot-outlet ports
    // at the body ends (they are derived from `width`, like the boiler connectors).
    const withConnectors: MepWaterHeaterParams = {
      ...params,
      connectors: buildWaterHeaterConnectors(params),
    };
    const geometry: MepWaterHeaterGeometry = computeMepWaterHeaterGeometry(withConnectors);
    const validation = validateMepWaterHeaterParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-water-heater-params-updated', {
      waterHeaterId: this.entityId,
    });
  }

  protected withMergedPatch(nextPatch: MepWaterHeaterParams): UpdateMepWaterHeaterParamsCommand {
    return new UpdateMepWaterHeaterParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP water heater params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP water heater entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      waterHeaterId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
