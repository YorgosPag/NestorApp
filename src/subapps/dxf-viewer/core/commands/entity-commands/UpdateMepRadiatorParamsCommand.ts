/**
 * UPDATE MEP RADIATOR PARAMS COMMAND — ADR-408 Εύρος Β #1.
 *
 * Patches `params` on an existing `MepRadiatorEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepRadiatorGeometry()` +
 * `validateMepRadiatorParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * On execute / undo / redo emits `'bim:mep-radiator-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  MepRadiatorGeometry,
  MepRadiatorParams,
} from '../../../bim/types/mep-radiator-types';
import {
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../../../bim/mep-radiators/mep-radiator-geometry';
import { buildRadiatorConnectors } from '../../../bim/mep-radiators/mep-radiator-geometry';
import { EventBus } from '../../../systems/events/EventBus';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepRadiatorParamsCommand extends MergeableUpdateCommand<MepRadiatorParams> {
  readonly name = 'UpdateMepRadiatorParams';
  readonly type = 'update-mep-radiator-params';

  constructor(
    radiatorId: string,
    params: MepRadiatorParams,
    previousParams: MepRadiatorParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(radiatorId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepRadiatorParams): void {
    // Re-seed the two connectors so a width change keeps the supply/return ports at
    // the body ends (they are derived from `width`, like the manifold connectors).
    const withConnectors: MepRadiatorParams = { ...params, connectors: buildRadiatorConnectors(params) };
    const geometry: MepRadiatorGeometry = computeMepRadiatorGeometry(withConnectors);
    const validation = validateMepRadiatorParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-radiator-params-updated', { radiatorId: this.entityId });
  }

  protected withMergedPatch(nextPatch: MepRadiatorParams): UpdateMepRadiatorParamsCommand {
    return new UpdateMepRadiatorParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP radiator params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP radiator entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }

  protected serializedData(): Record<string, unknown> {
    return {
      radiatorId: this.entityId,
      params: this.patch,
      previousParams: this.previousPatch,
      isDragging: this.isDragging,
    };
  }
}
