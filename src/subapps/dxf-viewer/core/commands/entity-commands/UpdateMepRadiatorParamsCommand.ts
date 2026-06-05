/**
 * UPDATE MEP RADIATOR PARAMS COMMAND — ADR-408 Εύρος Β #1.
 *
 * Patches `params` on an existing `MepRadiatorEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepRadiatorGeometry()` +
 * `validateMepRadiatorParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateMepManifoldParamsCommand` — supports
 * command merging for grip-drag operations so consecutive drag samples collapse
 * into a single undo entry.
 *
 * On execute / undo / redo emits `'bim:mep-radiator-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '../../../bim/types/mep-radiator-types';
import {
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../../../bim/mep-radiators/mep-radiator-geometry';
import { buildRadiatorConnectors } from '../../../bim/mep-radiators/mep-radiator-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { EventBus } from '../../../systems/events/EventBus';

export class UpdateMepRadiatorParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepRadiatorParams';
  readonly type = 'update-mep-radiator-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly radiatorId: string,
    private readonly params: MepRadiatorParams,
    private readonly previousParams: MepRadiatorParams,
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

  private applyPatch(params: MepRadiatorParams): void {
    // Re-seed the two connectors so a width change keeps the supply/return ports at
    // the body ends (they are derived from `width`, like the manifold connectors).
    const withConnectors: MepRadiatorParams = { ...params, connectors: buildRadiatorConnectors(params) };
    const geometry: MepRadiatorGeometry = computeMepRadiatorGeometry(withConnectors);
    const validation = validateMepRadiatorParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.radiatorId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-radiator-params-updated', { radiatorId: this.radiatorId });
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepRadiatorParamsCommand)) return false;
    if (other.radiatorId !== this.radiatorId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepRadiatorParamsCommand;
    return new UpdateMepRadiatorParamsCommand(
      this.radiatorId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP radiator params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.radiatorId];
  }

  validate(): string | null {
    if (!this.radiatorId) return 'MEP radiator entity ID is required';
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
        radiatorId: this.radiatorId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
