/**
 * UPDATE MEP BOILER PARAMS COMMAND — ADR-408 Εύρος Β #2.
 *
 * Patches `params` on an existing `MepBoilerEntity` and recomputes `geometry` +
 * `validation` atomically via `computeMepBoilerGeometry()` +
 * `validateMepBoilerParams()` so renderer reads never diverge from the
 * parametric source of truth.
 *
 * Merge/undo/redo skeleton is inherited from `MergeableUpdateCommand` (ADR-507 §8).
 * On execute / undo / redo emits `'bim:mep-boiler-params-updated'` so the
 * persistence host and 3D sync layer can react without polling the scene.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type {
  MepBoilerGeometry,
  MepBoilerParams,
} from '../../../bim/types/mep-boiler-types';
import {
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../../../bim/mep-boilers/mep-boiler-geometry';
import { buildBoilerConnectors } from '../../../bim/mep-boilers/mep-boiler-geometry';
import { EventBus } from '../../../systems/events/EventBus';
import { MergeableUpdateCommand } from './MergeableUpdateCommand';

export class UpdateMepBoilerParamsCommand extends MergeableUpdateCommand<MepBoilerParams> {
  readonly name = 'UpdateMepBoilerParams';
  readonly type = 'update-mep-boiler-params';

  constructor(
    boilerId: string,
    params: MepBoilerParams,
    previousParams: MepBoilerParams,
    sceneManager: ISceneManager,
    isDragging: boolean = false,
  ) {
    super(boilerId, params, previousParams, sceneManager, isDragging);
  }

  protected applyPatch(params: MepBoilerParams): void {
    // Re-seed the two connectors so a width change keeps the supply/return ports at
    // the body ends (they are derived from `width`, like the manifold connectors).
    const withConnectors: MepBoilerParams = { ...params, connectors: buildBoilerConnectors(params) };
    const geometry: MepBoilerGeometry = computeMepBoilerGeometry(withConnectors);
    const validation = validateMepBoilerParams(withConnectors).bimValidation;
    this.sceneManager.updateEntity(this.entityId, {
      kind: withConnectors.kind,
      params: withConnectors,
      geometry,
      validation,
    } as unknown as Partial<SceneEntity>);
    EventBus.emit('bim:mep-boiler-params-updated', { boilerId: this.entityId });
  }

  protected withMergedPatch(nextPatch: MepBoilerParams): UpdateMepBoilerParamsCommand {
    return new UpdateMepBoilerParamsCommand(
      this.entityId,
      nextPatch,
      this.previousPatch,
      this.sceneManager,
      true,
    );
  }

  getDescription(): string {
    return `Update MEP boiler params (${this.patch.kind})`;
  }

  validate(): string | null {
    if (!this.entityId) return 'MEP boiler entity ID is required';
    if (this.patch.width <= 0) return 'width must be > 0';
    if (this.patch.length <= 0) return 'length must be > 0';
    if (this.patch.bodyHeightMm <= 0) return 'bodyHeightMm must be > 0';
    if (!Number.isFinite(this.patch.rotation)) return 'rotation must be finite';
    return null;
  }
}
