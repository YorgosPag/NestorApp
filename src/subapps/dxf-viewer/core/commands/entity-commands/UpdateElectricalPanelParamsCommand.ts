/**
 * UPDATE ELECTRICAL PANEL PARAMS COMMAND — ADR-408 Φ3.
 *
 * Patches `params` on an existing `ElectricalPanelEntity` and recomputes
 * `geometry` + `validation` atomically via `computeElectricalPanelGeometry()` +
 * `validateElectricalPanelParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateMepFixtureParamsCommand` —
 * supports command merging for grip-drag operations so consecutive drag samples
 * collapse into a single undo entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '../../../bim/types/electrical-panel-types';
import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../../../bim/electrical-panels/electrical-panel-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';

export class UpdateElectricalPanelParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateElectricalPanelParams';
  readonly type = 'update-electrical-panel-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly panelId: string,
    private readonly params: ElectricalPanelParams,
    private readonly previousParams: ElectricalPanelParams,
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

  private applyPatch(params: ElectricalPanelParams): void {
    const geometry: ElectricalPanelGeometry = computeElectricalPanelGeometry(params);
    const validation = validateElectricalPanelParams(params).bimValidation;
    this.sceneManager.updateEntity(this.panelId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateElectricalPanelParamsCommand)) return false;
    if (other.panelId !== this.panelId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateElectricalPanelParamsCommand;
    return new UpdateElectricalPanelParamsCommand(
      this.panelId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update electrical panel params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.panelId];
  }

  validate(): string | null {
    if (!this.panelId) return 'Electrical panel entity ID is required';
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
        panelId: this.panelId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
