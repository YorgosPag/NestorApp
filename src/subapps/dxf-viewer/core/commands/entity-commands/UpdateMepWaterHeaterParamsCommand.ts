/**
 * UPDATE MEP WATER HEATER PARAMS COMMAND — ADR-408 DHW.
 *
 * Patches `params` on an existing `MepWaterHeaterEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepWaterHeaterGeometry()` +
 * `validateMepWaterHeaterParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateMepBoilerParamsCommand` — supports
 * command merging for grip-drag operations so consecutive drag samples collapse
 * into a single undo entry.
 *
 * On execute / undo / redo emits `'bim:mep-water-heater-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  MepWaterHeaterGeometry,
  MepWaterHeaterParams,
} from '../../../bim/types/mep-water-heater-types';
import {
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../../../bim/mep-water-heaters/mep-water-heater-geometry';
import { buildWaterHeaterConnectors } from '../../../bim/mep-water-heaters/mep-water-heater-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { EventBus } from '../../../systems/events/EventBus';

export class UpdateMepWaterHeaterParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepWaterHeaterParams';
  readonly type = 'update-mep-water-heater-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly waterHeaterId: string,
    private readonly params: MepWaterHeaterParams,
    private readonly previousParams: MepWaterHeaterParams,
    private readonly sceneManager: ISceneManager,
    private readonly isDragging: boolean = false,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.applyPatch(this.params);
    this.wasExecuted = true;
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.applyPatch(this.previousParams);
  }

  redo(): void {
    this.applyPatch(this.params);
  }

  private applyPatch(params: MepWaterHeaterParams): void {
    // Re-seed the two connectors so a width change keeps the cold-inlet / hot-outlet ports
    // at the body ends (they are derived from `width`, like the boiler connectors).
    const withConnectors: MepWaterHeaterParams = {
      ...params,
      connectors: buildWaterHeaterConnectors(params),
    };
    const geometry: MepWaterHeaterGeometry = computeMepWaterHeaterGeometry(withConnectors);
    const validation = validateMepWaterHeaterParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.waterHeaterId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-water-heater-params-updated', {
      waterHeaterId: this.waterHeaterId,
    });
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepWaterHeaterParamsCommand)) return false;
    if (other.waterHeaterId !== this.waterHeaterId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return other.timestamp - this.timestamp < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepWaterHeaterParamsCommand;
    return new UpdateMepWaterHeaterParamsCommand(
      this.waterHeaterId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP water heater params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.waterHeaterId];
  }

  validate(): string | null {
    if (!this.waterHeaterId) return 'MEP water heater entity ID is required';
    if (this.params.width <= 0) return 'width must be > 0';
    if (this.params.length <= 0) return 'length must be > 0';
    if (this.params.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.params.rotation)) return 'rotation must be finite';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        waterHeaterId: this.waterHeaterId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
