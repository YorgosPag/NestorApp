/**
 * UPDATE MEP MANIFOLD PARAMS COMMAND — ADR-408 Φ12.
 *
 * Patches `params` on an existing `MepManifoldEntity` and recomputes
 * `geometry` + `validation` atomically via `computeMepManifoldGeometry()` +
 * `validateMepManifoldParams()` so renderer reads never diverge from the
 * parametric source of truth. Mirrors `UpdateElectricalPanelParamsCommand` —
 * supports command merging for grip-drag operations so consecutive drag samples
 * collapse into a single undo entry.
 *
 * On execute / undo / redo emits `'bim:mep-manifold-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type {
  MepManifoldGeometry,
  MepManifoldParams,
} from '../../../bim/types/mep-manifold-types';
import {
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../../../bim/mep-manifolds/mep-manifold-geometry';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { DEFAULT_MERGE_CONFIG } from '../interfaces';
import { EventBus } from '../../../systems/events/EventBus';

export class UpdateMepManifoldParamsCommand implements ICommand {
  readonly id: string;
  readonly name = 'UpdateMepManifoldParams';
  readonly type = 'update-mep-manifold-params';
  readonly timestamp: number;

  private wasExecuted = false;

  constructor(
    private readonly manifoldId: string,
    private readonly params: MepManifoldParams,
    private readonly previousParams: MepManifoldParams,
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

  private applyPatch(params: MepManifoldParams): void {
    const geometry: MepManifoldGeometry = computeMepManifoldGeometry(params);
    const validation = validateMepManifoldParams(params).bimValidation;
    this.sceneManager.updateEntity(this.manifoldId, {
      kind: params.kind,
      params,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-manifold-params-updated', { manifoldId: this.manifoldId });
  }

  canMergeWith(other: ICommand): boolean {
    if (!(other instanceof UpdateMepManifoldParamsCommand)) return false;
    if (other.manifoldId !== this.manifoldId) return false;
    if (!this.isDragging || !other.isDragging) return false;
    return (other.timestamp - this.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
  }

  mergeWith(other: ICommand): ICommand {
    const o = other as UpdateMepManifoldParamsCommand;
    return new UpdateMepManifoldParamsCommand(
      this.manifoldId,
      o.params,
      this.previousParams,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP manifold params (${this.params.kind})`;
  }

  getAffectedEntityIds(): string[] {
    return [this.manifoldId];
  }

  validate(): string | null {
    if (!this.manifoldId) return 'MEP manifold entity ID is required';
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
        manifoldId: this.manifoldId,
        params: this.params,
        previousParams: this.previousParams,
        isDragging: this.isDragging,
      },
      version: 1,
    };
  }
}
