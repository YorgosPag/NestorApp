/**
 * UPDATE ELECTRICAL PANEL PARAMS COMMAND — ADR-408 Φ3.
 *
 * Patches `params` on an existing `ElectricalPanelEntity` and recomputes
 * `geometry` + `validation` atomically via `computeElectricalPanelGeometry()` +
 * `validateElectricalPanelParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '../../../bim/types/electrical-panel-types';
import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../../../bim/electrical-panels/electrical-panel-geometry';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateElectricalPanelParamsCommand extends MergeableUpdateCommand<ElectricalPanelParams> {
  readonly name = 'UpdateElectricalPanelParams';
  readonly type = 'update-electrical-panel-params';

  constructor(
    panelId: string,
    params: ElectricalPanelParams,
    previousParams: ElectricalPanelParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(panelId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: ElectricalPanelParams): void {
    const geometry: ElectricalPanelGeometry = computeElectricalPanelGeometry(params);
    const validation = validateElectricalPanelParams(params).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  protected withMergedPatch(nextPatch: ElectricalPanelParams): UpdateElectricalPanelParamsCommand {
    return new UpdateElectricalPanelParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update electrical panel params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Electrical panel entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      panelId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
