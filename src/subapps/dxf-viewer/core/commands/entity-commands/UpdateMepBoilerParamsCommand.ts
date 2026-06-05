/**
 * UPDATE MEP BOILER PARAMS COMMAND — ADR-408 Εύρος Β #2.
 *
 * Patches `params` on an existing `MepBoilerEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepBoilerGeometry()` +
 * `validateMepBoilerParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateMepRadiatorParamsCommand` — supports
 * command merging for grip-drag operations so consecutive drag samples collapse
 * into a single undo entry.
 *
 * On execute / undo / redo emits `'bim:mep-boiler-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../../../bim/types/mep-boiler-types';
import {
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../../../bim/mep-boilers/mep-boiler-geometry';
import { buildBoilerConnectors } from '../../../bim/mep-boilers/mep-boiler-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { EventBus } from '../../../systems/events/EventBus';

export class UpdateMepBoilerParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepBoilerParams';
  readonly type = 'update-mep-boiler-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly boilerId: string,
    private readonly params: MepBoilerParams,
    private readonly previousParams: MepBoilerParams,
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

  private applyPatch(params: MepBoilerParams): void {
    // Re-seed the two connectors so a width change keeps the supply/return ports at
    // the body ends (they are derived from `width`, like the manifold connectors).
    const withConnectors: MepBoilerParams = { ...params, connectors: buildBoilerConnectors(params) };
    const geometry: MepBoilerGeometry = computeMepBoilerGeometry(withConnectors);
    const validation = validateMepBoilerParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.boilerId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-boiler-params-updated', { boilerId: this.boilerId });
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepBoilerParamsCommand)) return false;
    if (other.boilerId !== this.boilerId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepBoilerParamsCommand;
    return new UpdateMepBoilerParamsCommand(
      this.boilerId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP boiler params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.boilerId];
  }

  validate(): string | null {
    if (!this.boilerId) return 'MEP boiler entity ID is required';
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
        boilerId: this.boilerId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
